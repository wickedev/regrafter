/**
 * HoistExecutor - Executes hoisting operations on AST
 *
 * This module implements the actual AST transformations for hoisting dependencies.
 * It takes a HoistPlan from the HoistPlanner and executes all operations on the AST.
 */

import type { NodePath } from '@babel/traverse';
import traverseModule from '@babel/traverse';
import * as t from '@babel/types';

import { createInternalError } from '../errors/index.js';
import type { InternalErrorType, ValidationErrorType } from '../errors/index.js';
import { ok, err, isErr } from '../result/index.js';
import type { Result } from '../result/index.js';
import type {
  InternalDependency,
  HoistOperation,
  PropThreadOperation,
  ImportOperation,
} from '../types/internal.js';
import { HoistStrategy } from '../types/internal.js';
import { loadTraverseFunction, createLogger } from '../utils/index.js';

const traverse = loadTraverseFunction(traverseModule);

import type { HoistPlan } from './types.js';

const logger = createLogger('HoistExecutor');

/**
 * Context for hoisting execution
 */
export interface HoistExecutionContext {
  /** The AST being modified */
  ast: t.File;
  /** Map of dependency IDs to their AST paths */
  dependencyPaths: Map<string, NodePath>;
  /** Map of scope names to their AST paths */
  scopePaths: Map<string, NodePath>;
  /** The dependency being hoisted */
  dependency?: InternalDependency;
  /** Track insertion indices per scope to maintain order */
  insertionIndices?: Map<string, number>;
}

/**
 * Executes a hoisting plan on an AST
 */
export class HoistExecutor {
  /**
   * Execute a complete hoisting plan
   */
  execute(plan: HoistPlan, context: HoistExecutionContext): Result<void, InternalErrorType | ValidationErrorType> {
    if (!plan.valid) {
      return err(
        createInternalError({
          code: 'E001',
          message: `HoistExecutor.execute: Cannot execute invalid hoisting plan - ${plan.invalidReason ?? 'Unknown reason'}`,
        })
      );
    }

    // Initialize insertion index tracking
    context.insertionIndices ??= new Map();

    // Execute hoisting operations first (move declarations)
    for (const operation of plan.hoistOperations) {
      const result = this.executeHoistOperation(operation, context);
      if (isErr(result)) {
        return err(result.error);
      }
    }

    // Execute import operations (add imports)
    for (const operation of plan.importOperations) {
      this.executeImportOperation(operation, context);
    }

    // Execute prop threading operations (add prop passing)
    for (const operation of plan.propThreadOperations) {
      this.executePropThreadOperation(operation, context);
    }

    return ok(undefined);
  }

  /**
   * Execute a single hoist operation
   */
  private executeHoistOperation(
    operation: HoistOperation,
    context: HoistExecutionContext
  ): Result<void, InternalErrorType | ValidationErrorType> {
    switch (operation.strategy) {
      case HoistStrategy.Hoist:
        this.executeHoisting(operation, context);
        break;
      case HoistStrategy.PassAsProp:
      case HoistStrategy.CreateShared:
      case HoistStrategy.WrapProvider:
      case HoistStrategy.ExtractContext:
        // These strategies are handled by their respective operation types
        // (PropThreadOperation, ImportOperation, etc.)
        break;
      default: {
        // Exhaustive check - all enum values should be handled above
        const exhaustiveCheck: never = operation.strategy;
        return err(
          createInternalError({
            code: 'E001',
            message: `HoistExecutor.executeHoistOperation: Unknown hoisting strategy ${String(exhaustiveCheck)}`,
          })
        );
      }
    }
    return ok(undefined);
  }

  /**
   * Execute hoisting by moving a declaration to a new scope
   */
  private executeHoisting(
    operation: HoistOperation,
    context: HoistExecutionContext
  ): void {
    // Find the dependency node to hoist
    const dependencyPath = context.dependencyPaths.get(operation.dependencyId);
    if (!dependencyPath) {
      logger.warn(
        `Cannot hoist: dependency ${operation.symbol} not found in dependency paths`
      );
      return;
    }

    // Find the target scope
    const targetPath = context.scopePaths.get(operation.toScope);
    if (!targetPath) {
      logger.warn(
        `Cannot hoist: target scope ${operation.toScope} not found in scope paths`
      );
      return;
    }

    // Get the declaration statement
    let declarationPath = dependencyPath;

    // If it's an identifier reference, find its declaration
    if (declarationPath.isIdentifier() || declarationPath.isJSXIdentifier()) {
      const binding = declarationPath.scope.getBinding(operation.symbol);
      const bindingPath = binding?.path;
      if (bindingPath) {
        declarationPath = bindingPath;
      }
    }

    // Navigate to the statement level
    while (!declarationPath.isStatement()) {
      const parent = declarationPath.parentPath;
      if (parent === null) {
        break;
      }
      declarationPath = parent;
    }

    if (!declarationPath.isStatement()) {
      logger.warn(
        `Cannot hoist: could not find statement for ${operation.symbol}`
      );
      return;
    }

    // Clone the declaration
    const declarationNode = t.cloneNode(declarationPath.node, true, true);

    // Get or initialize insertion index for this scope
    const scopeId = operation.toScope;
    const insertionIndices = context.insertionIndices ?? new Map<string, number>();
    const currentIndex = insertionIndices.get(scopeId) ?? 0;

    // For function/component scopes, insert at the tracked position
    if (targetPath.isFunctionDeclaration() || targetPath.isFunctionExpression() || targetPath.isArrowFunctionExpression()) {
      const bodyPath = targetPath.get('body');
      if (Array.isArray(bodyPath)) {
        // Not a block statement, can't insert multiple declarations
        logger.warn(`Cannot hoist to non-block function body`);
        return;
      } else if (bodyPath.isBlockStatement()) {
        const body = bodyPath.node.body;
        // Insert at the current index position
        body.splice(currentIndex, 0, declarationNode);
        // Increment the insertion index for next insertion in this scope
        insertionIndices.set(scopeId, currentIndex + 1);

        // Remove the original declaration
        // Check if this would leave the parent function empty
        const parentFunction = declarationPath.getFunctionParent();
        if (parentFunction) {
          const parentBodyPath = parentFunction.get('body');
          if (parentBodyPath.isBlockStatement()) {
            // Count how many statements will remain after removal
            const currentStatements = parentBodyPath.node.body;
            if (currentStatements.length === 1) {
              // This is the last statement - replace with empty return to keep function valid
              declarationPath.replaceWith(t.returnStatement());
            } else {
              // Safe to remove - there are other statements
              declarationPath.remove();
            }
          } else {
            // Not a block statement, safe to remove
            declarationPath.remove();
          }
        } else {
          // No parent function, safe to remove
          declarationPath.remove();
        }
      } else {
        logger.warn(`Cannot find block statement in target scope`);
        return;
      }
    } else {
      logger.warn(`Target scope is not a function`);
      return;
    }
  }

  /**
   * Execute import operation
   */
  private executeImportOperation(
    operation: ImportOperation,
    context: HoistExecutionContext
  ): void {
    // Build import specifiers
    const specifiers: Array<t.ImportSpecifier | t.ImportDefaultSpecifier | t.ImportNamespaceSpecifier> = [];

    for (const spec of operation.specifiers) {
      switch (spec.type) {
        case 'default':
          specifiers.push(
            t.importDefaultSpecifier(t.identifier(spec.local))
          );
          break;
        case 'named':
          specifiers.push(
            t.importSpecifier(
              t.identifier(spec.local),
              t.identifier(spec.imported)
            )
          );
          break;
        case 'namespace':
          specifiers.push(
            t.importNamespaceSpecifier(t.identifier(spec.local))
          );
          break;
      }
    }

    // Create import declaration
    const importDeclaration = t.importDeclaration(
      specifiers,
      t.stringLiteral(operation.importSource)
    );

    // Find where to insert the import
    const programPath = context.ast.program;
    const body = programPath.body;

    // Find the last existing import or insert at the beginning
    let insertIndex = 0;
    for (let i = body.length - 1; i >= 0; i--) {
      if (t.isImportDeclaration(body[i])) {
        insertIndex = i + 1;
        break;
      }
    }

    // Insert the import
    body.splice(insertIndex, 0, importDeclaration);
  }

  /**
   * Execute prop threading operation
   */
  private executePropThreadOperation(
    operation: PropThreadOperation,
    context: HoistExecutionContext
  ): void {
    // This is a placeholder implementation
    // Prop threading requires:
    // 1. Adding prop to component parameters
    // 2. Passing prop through intermediate components
    // 3. Using prop at the destination

    // For now, we'll implement basic prop passing
    traverse(context.ast, {
      // Find JSX elements for components in the threading path
      JSXElement(path: NodePath<t.JSXElement>) {
        const openingElement = path.node.openingElement;
        if (t.isJSXIdentifier(openingElement.name)) {
          const componentName = openingElement.name.name;

          // Check if this component is in the threading path
          if (operation.path.includes(componentName)) {
            // Check if prop already exists
            const hasProp = openingElement.attributes.some(attr =>
              t.isJSXAttribute(attr) &&
              t.isJSXIdentifier(attr.name) &&
              attr.name.name === operation.propName
            );

            if (!hasProp) {
              // Add the prop
              const propAttribute = t.jsxAttribute(
                t.jsxIdentifier(operation.propName),
                t.jsxExpressionContainer(t.identifier(operation.propName))
              );
              openingElement.attributes.push(propAttribute);
            }
          }
        }
      },

      // Add prop to function parameters
      FunctionDeclaration(path: NodePath<t.FunctionDeclaration>) {
        if (path.node.id && operation.path.includes(path.node.id.name)) {
          addPropToFunctionParams(path, operation.propName);
        }
      },

      FunctionExpression(path: NodePath<t.FunctionExpression>) {
        // Find parent variable declarator to get function name
        const parent = path.parent;
        if (t.isVariableDeclarator(parent) && t.isIdentifier(parent.id)) {
          if (operation.path.includes(parent.id.name)) {
            addPropToFunctionParams(path, operation.propName);
          }
        }
      },

      ArrowFunctionExpression(path: NodePath<t.ArrowFunctionExpression>) {
        // Find parent variable declarator to get function name
        const parent = path.parent;
        if (t.isVariableDeclarator(parent) && t.isIdentifier(parent.id)) {
          if (operation.path.includes(parent.id.name)) {
            addPropToFunctionParams(path, operation.propName);
          }
        }
      },
    });
  }
}

/**
 * Helper function to add a prop to function parameters
 */
function addPropToFunctionParams(
  path: NodePath<t.FunctionDeclaration | t.FunctionExpression | t.ArrowFunctionExpression>,
  propName: string
): void {
  const params = path.node.params;

  // Check if there's already a props parameter
  if (params.length > 0) {
    const firstParam = params[0];

    // If it's an object pattern, add the prop
    if (t.isObjectPattern(firstParam)) {
      const hasProperty = firstParam.properties.some(prop =>
        t.isObjectProperty(prop) &&
        t.isIdentifier(prop.key) &&
        prop.key.name === propName
      );

      if (!hasProperty) {
        firstParam.properties.push(
          t.objectProperty(
            t.identifier(propName),
            t.identifier(propName),
            false,
            true
          )
        );
      }
    }
    // If it's an identifier, we'd need to destructure it, which is complex
    // For now, skip this case
  } else {
    // No parameters, add a props destructure
    params.push(
      t.objectPattern([
        t.objectProperty(
          t.identifier(propName),
          t.identifier(propName),
          false,
          true
        ),
      ])
    );
  }
}

/**
 * Create a hoisting executor
 */
export function createHoistExecutor(): HoistExecutor {
  return new HoistExecutor();
}
