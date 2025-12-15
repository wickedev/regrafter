/**
 * Sink Executor
 *
 * Executes sink operations by moving declarations to optimal scope locations,
 * removing orphaned props, and detecting/removing dead code.
 *
 * Task 5.2: Sink Execution
 * - Move declarations to optimal scope
 * - Orphaned prop removal
 * - Dead code detection and removal
 */

import traverse, { NodePath } from '@babel/traverse';
import * as t from '@babel/types';

import { createPropRemoval , generateId } from '../types/factories.js';
import type {
  SinkCandidate,
  PropRemoval,
  ScopeInfo,
} from '../types/index.js';

import type {
  ISinkExecutor,
  SinkExecutionResult,
  DeadCodeInfo,
  SinkOperation,
  SinkModification,
} from './types.js';


/**
 * SinkExecutor handles the actual transformation of ASTs to sink
 * declarations to their optimal locations.
 */
export class SinkExecutor implements ISinkExecutor {
  private usedIdentifiers: WeakMap<t.File, Set<string>> = new WeakMap();

  /**
   * Execute sink operations on the given candidates.
   *
   * @param candidates - Sink candidates to process
   * @param asts - Map of file paths to ASTs
   * @returns Execution result
   */
  execute(
    candidates: SinkCandidate[],
    asts: Map<string, t.File>
  ): SinkExecutionResult {
    const sunkDependencies: SinkCandidate[] = [];
    const removedProps: PropRemoval[] = [];
    const deadCodeRemoved: DeadCodeInfo[] = [];
    const errors: string[] = [];

    // Plan sink operations
    const operations = this.planSinkOperations(candidates);

    // Execute each operation
    for (const operation of operations) {
      try {
        const result = this.executeSinkOperation(operation, asts);
        if (result.success) {
          sunkDependencies.push(operation.candidate);
        } else if (result.error) {
          errors.push(result.error);
        }
      } catch (error) {
        errors.push(
          `Failed to sink ${operation.candidate.dependency.symbol}: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    }

    // After sinking, check for orphaned props
    const propsToCheck = candidates.map((c) => c.dependency.symbol);
    const orphanedProps = this.removeOrphanedProps(asts, propsToCheck);
    removedProps.push(...orphanedProps);

    // Detect and remove dead code
    const deadCode = this.removeDeadCode(asts);
    deadCodeRemoved.push(...deadCode);

    return {
      success: errors.length === 0,
      sunkDependencies,
      removedProps,
      deadCodeRemoved,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Remove orphaned props from components.
   *
   * Props become orphaned when the dependency they provided
   * has been sunk to a deeper scope.
   *
   * @param asts - Map of file paths to ASTs
   * @param propsToCheck - Prop names to check for removal
   * @returns Array of removed props
   */
  removeOrphanedProps(
    asts: Map<string, t.File>,
    propsToCheck: string[]
  ): PropRemoval[] {
    const removedProps: PropRemoval[] = [];
    const propsSet = new Set(propsToCheck);

    for (const [_filePath, ast] of asts) {
      // Find used identifiers in this file
      const usedIds = this.collectUsedIdentifiers(ast);

      traverse(ast, {
        // Check JSX attributes for orphaned props
        JSXAttribute(path) {
          const name = path.node.name;
          if (!t.isJSXIdentifier(name)) return;

          const propName = name.name;
          if (!propsSet.has(propName)) return;

          // Check if this prop value is still used
          const value = path.node.value;
          if (!value) return;

          // If the value is an identifier that's no longer used, remove the prop
          if (t.isJSXExpressionContainer(value)) {
            const expr = value.expression;
            if (
              t.isIdentifier(expr) &&
              !usedIds.has(expr.name) &&
              propsSet.has(expr.name)
            ) {
              const componentName = getComponentName(path);
              removedProps.push(
                createPropRemoval({
                  component: componentName,
                  propName,
                })
              );
              path.remove();
            }
          }
        },

        // Check component prop destructuring
        FunctionDeclaration(path) {
          checkAndRemoveOrphanedPropParams(path, propsSet, usedIds, removedProps);
        },
        FunctionExpression(path) {
          checkAndRemoveOrphanedPropParams(path, propsSet, usedIds, removedProps);
        },
        ArrowFunctionExpression(path) {
          checkAndRemoveOrphanedPropParams(path, propsSet, usedIds, removedProps);
        },
      });

      // Update the cached used identifiers after modifications
      this.usedIdentifiers.delete(ast);
    }

    return removedProps;
  }

  /**
   * Detect and remove dead code from ASTs.
   *
   * @param asts - Map of file paths to ASTs
   * @returns Array of removed dead code items
   */
  removeDeadCode(asts: Map<string, t.File>): DeadCodeInfo[] {
    const deadCode: DeadCodeInfo[] = [];

    for (const [filePath, ast] of asts) {
      // Collect all used identifiers
      const usedIds = this.collectUsedIdentifiers(ast);

      // Find and remove unused declarations
      traverse(ast, {
        // Check variable declarations
        VariableDeclarator(path) {
          const id = path.node.id;
          if (!t.isIdentifier(id)) return;

          // Don't remove exports
          if (isExported(path)) return;

          // Check if this variable is used anywhere
          if (!usedIds.has(id.name)) {
            deadCode.push({
              type: 'unused_variable',
              name: id.name,
              file: filePath,
              location: path.node.loc,
            });

            // Remove the declarator
            const parent = path.parentPath;
            if (
              parent?.isVariableDeclaration() &&
              parent.node.declarations.length === 1
            ) {
              // If this is the only declarator, remove the whole declaration
              parent.remove();
            } else {
              path.remove();
            }
          }
        },

        // Check unused imports
        ImportSpecifier(path) {
          const local = path.node.local.name;
          if (!usedIds.has(local)) {
            deadCode.push({
              type: 'unused_import',
              name: local,
              file: filePath,
              location: path.node.loc,
            });

            // Remove the specifier
            const importDecl = path.parentPath;
            if (
              importDecl?.isImportDeclaration() &&
              importDecl.node.specifiers.length === 1
            ) {
              // If this is the only specifier, remove the whole import
              importDecl.remove();
            } else {
              path.remove();
            }
          }
        },

        ImportDefaultSpecifier(path) {
          const local = path.node.local.name;
          if (!usedIds.has(local)) {
            deadCode.push({
              type: 'unused_import',
              name: local,
              file: filePath,
              location: path.node.loc,
            });

            // Only remove if there are other specifiers
            const importDecl = path.parentPath;
            if (
              importDecl?.isImportDeclaration() &&
              importDecl.node.specifiers.length === 1
            ) {
              importDecl.remove();
            } else {
              path.remove();
            }
          }
        },

        // Check for unreachable code after return statements
        ReturnStatement(path) {
          const siblings = path.getAllNextSiblings();
          for (const sibling of siblings) {
            // Skip if it's a function declaration (hoisted)
            if (sibling.isFunctionDeclaration()) continue;

            deadCode.push({
              type: 'unreachable_code',
              name: sibling.node.type,
              file: filePath,
              location: sibling.node.loc ?? null,
            });
            sibling.remove();
          }
        },
      });

      // Clear cache after modifications
      this.usedIdentifiers.delete(ast);
    }

    return deadCode;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Private Helper Methods
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Plan sink operations from candidates.
   */
  private planSinkOperations(candidates: SinkCandidate[]): SinkOperation[] {
    const operations: SinkOperation[] = [];

    for (const candidate of candidates) {
      if (!candidate.sinkable) continue;

      const modifications: SinkModification[] = [];

      // Add modification to move the declaration
      modifications.push({
        type: 'move',
        file: candidate.dependency.origin.file,
        path: candidate.dependency.scope.path,
        description: `Move ${candidate.dependency.symbol} from ${
          candidate.currentScope.type
        } to ${candidate.optimalScope.type}`,
      });

      operations.push({
        id: generateId('sink_op'),
        candidate,
        targetScope: candidate.optimalScope,
        modifications,
      });
    }

    return operations;
  }

  /**
   * Execute a single sink operation.
   */
  private executeSinkOperation(
    operation: SinkOperation,
    asts: Map<string, t.File>
  ): { success: boolean; error?: string } {
    const { candidate, targetScope } = operation;
    const dep = candidate.dependency;

    // Find the AST for this file
    const ast = asts.get(dep.origin.file);
    if (!ast) {
      return { success: false, error: `AST not found for file: ${dep.origin.file}` };
    }

    let moved = false;
    let declarationNode: t.Node | null = null;

    // Find and extract the declaration
    traverse(ast, {
      VariableDeclaration(path) {
        for (let i = 0; i < path.node.declarations.length; i++) {
          const declarator = path.node.declarations[i];
          if (
            t.isIdentifier(declarator?.id) &&
            declarator.id.name === dep.symbol
          ) {
            // Found the declaration
            declarationNode = t.variableDeclaration(path.node.kind, [declarator]);

            if (path.node.declarations.length === 1) {
              path.remove();
            } else {
              path.node.declarations.splice(i, 1);
            }
            path.stop();
            break;
          }
        }
      },
    });

    if (!declarationNode) {
      return {
        success: false,
        error: `Declaration not found for symbol: ${dep.symbol}`,
      };
    }

    // Insert at target scope
    traverse(ast, {
      enter(path) {
        if (isSameScopeNode(path, targetScope)) {
          // Insert declaration at the beginning of the scope
          if (path.isBlockStatement()) {
            path.node.body.unshift(declarationNode as t.Statement);
            moved = true;
            path.stop();
          } else if (path.isProgram()) {
            // Find first non-import statement
            const body = path.node.body;
            let insertIndex = 0;
            for (let i = 0; i < body.length; i++) {
              if (!t.isImportDeclaration(body[i])) {
                insertIndex = i;
                break;
              }
              insertIndex = i + 1;
            }
            body.splice(insertIndex, 0, declarationNode as t.Statement);
            moved = true;
            path.stop();
          }
        }
      },
    });

    if (!moved) {
      return {
        success: false,
        error: `Could not insert declaration at target scope for: ${dep.symbol}`,
      };
    }

    return { success: true };
  }

  /**
   * Collect all used identifiers in an AST.
   */
  private collectUsedIdentifiers(ast: t.File): Set<string> {
    // Check cache
    const cached = this.usedIdentifiers.get(ast);
    if (cached) {
      return cached;
    }

    const used = new Set<string>();

    traverse(ast, {
      Identifier(path: NodePath) {
        // Skip binding declarations
        if (path.isBindingIdentifier()) return;

        // Skip property access (obj.prop - skip prop)
        if (
          path.parentPath?.isMemberExpression() &&
          path.key === 'property' &&
          !path.parentPath.node.computed
        ) {
          return;
        }

        // Skip import specifier names
        if (
          path.parentPath?.isImportSpecifier() &&
          path.key === 'imported'
        ) {
          return;
        }

        // Skip object property keys
        if (
          path.parentPath?.isObjectProperty() &&
          path.key === 'key' &&
          !path.parentPath.node.computed
        ) {
          return;
        }

        used.add(path.node.name);
      },
      JSXIdentifier(path) {
        // JSX element names are used
        if (path.parentPath?.isJSXOpeningElement()) {
          used.add(path.node.name);
        }
      },
    });

    this.usedIdentifiers.set(ast, used);
    return used;
  }
}

/**
 * Check and remove orphaned prop parameters from function components.
 */
function checkAndRemoveOrphanedPropParams(
  path: NodePath<t.FunctionDeclaration | t.FunctionExpression | t.ArrowFunctionExpression>,
  propsSet: Set<string>,
  usedIds: Set<string>,
  removedProps: PropRemoval[]
): void {
  const params = path.node.params;
  if (params.length === 0) return;

  const firstParam = params[0];

  // Check for destructured props: ({ prop1, prop2 }) => ...
  if (t.isObjectPattern(firstParam)) {
    const toRemove: number[] = [];

    for (let i = 0; i < firstParam.properties.length; i++) {
      const prop = firstParam.properties[i];
      if (!t.isObjectProperty(prop)) continue;

      const key = prop.key;
      if (!t.isIdentifier(key)) continue;

      if (propsSet.has(key.name) && !usedIds.has(key.name)) {
        toRemove.push(i);
        removedProps.push(
          createPropRemoval({
            component: getFunctionName(path) ?? 'Anonymous',
            propName: key.name,
          })
        );
      }
    }

    // Remove in reverse order to maintain indices
    for (let i = toRemove.length - 1; i >= 0; i--) {
      firstParam.properties.splice(toRemove[i]!, 1);
    }
  }
}

/**
 * Get the name of a component from a JSX attribute path.
 */
function getComponentName(attrPath: NodePath<t.JSXAttribute>): string {
  let current: NodePath | null = attrPath;
  while (current) {
    if (current.isJSXElement()) {
      const opening = current.node.openingElement;
      const name = opening.name;
      if (t.isJSXIdentifier(name)) {
        return name.name;
      }
    }
    current = current.parentPath;
  }
  return 'Unknown';
}

/**
 * Get the name of a function.
 */
function getFunctionName(
  path: NodePath<t.FunctionDeclaration | t.FunctionExpression | t.ArrowFunctionExpression>
): string | null {
  if (path.isFunctionDeclaration() && path.node.id) {
    return path.node.id.name;
  }
  if (path.parentPath?.isVariableDeclarator()) {
    const id = path.parentPath.node.id;
    if (t.isIdentifier(id)) {
      return id.name;
    }
  }
  return null;
}

/**
 * Check if a declaration is exported.
 */
function isExported(path: NodePath): boolean {
  let current: NodePath | null = path;
  while (current) {
    if (
      current.isExportNamedDeclaration() ||
      current.isExportDefaultDeclaration()
    ) {
      return true;
    }
    current = current.parentPath;
  }
  return false;
}

/**
 * Check if a path corresponds to a given scope.
 */
function isSameScopeNode(path: NodePath, scope: ScopeInfo): boolean {
  // Compare by node identity if scope has a path
  if (scope.path && scope.path.node === path.node) {
    return true;
  }

  // Fallback to comparing scope IDs stored in path data
  const pathScopeId = (path.node as { _scopeId?: string })._scopeId;
  return pathScopeId === scope.id;
}

/**
 * Create a SinkExecutor instance.
 */
export function createSinkExecutor(): SinkExecutor {
  return new SinkExecutor();
}
