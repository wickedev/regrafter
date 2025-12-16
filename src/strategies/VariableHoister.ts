/**
 * VariableHoister - Strategy for hoisting variable dependencies
 *
 * Handles hoisting of variable declarations based on purity analysis.
 * Pure variables are hoisted directly, while impure variables are
 * converted to prop threading.
 */

import type * as t from '@babel/types';

import {
  createHoistOperation,
  createPropThreadOperation,
} from '../types/factories.js';
import {
  HoistStrategy,
} from '../types/internal.js';
import type {
  HoistOperation,
  InternalDependency,
  ScopeInfo,
} from '../types/internal.js';
import { DependencyType } from '../types/public.js';

import type {
  HoistContext,
  HoistPlanItem,
  IVariableHoister,
  PurityAnalysis,
} from './types.js';
import { isHookName } from './types.js';

// ===============================================================================
// Purity Detection Constants
// ===============================================================================

/**
 * Known impure functions that indicate side effects
 */
const IMPURE_FUNCTIONS = new Set([
  // Console methods
  'console.log',
  'console.warn',
  'console.error',
  'console.info',
  'console.debug',
  // DOM manipulation
  'document.getElementById',
  'document.querySelector',
  'document.querySelectorAll',
  'document.createElement',
  // Side effects
  'fetch',
  'setTimeout',
  'setInterval',
  'requestAnimationFrame',
  'alert',
  'confirm',
  'prompt',
  // Date/Random
  'Date.now',
  'Math.random',
]);

/**
 * Known pure global objects
 */
const PURE_GLOBALS = new Set([
  'undefined',
  'null',
  'true',
  'false',
  'NaN',
  'Infinity',
  'Math',
  'JSON',
  'Object',
  'Array',
  'String',
  'Number',
  'Boolean',
  'Symbol',
  'BigInt',
  'Map',
  'Set',
  'WeakMap',
  'WeakSet',
  'Promise',
  'RegExp',
  'Error',
  'TypeError',
  'RangeError',
  'SyntaxError',
]);

// ===============================================================================
// VariableHoister Class
// ===============================================================================

/**
 * Strategy for hoisting variable dependencies.
 *
 * Determines whether variables should be:
 * - Hoisted directly (for pure variables)
 * - Passed as props (for impure/stateful variables)
 */
export class VariableHoister implements IVariableHoister {
  /**
   * Check if this strategy can handle the given dependency
   */
  canHandle(dependency: InternalDependency): boolean {
    return dependency.type === DependencyType.Variable;
  }

  /**
   * Determine if a variable is pure (no side effects)
   */
  isPure(dependency: InternalDependency): boolean {
    const analysis = this.analyzePurity(dependency);
    return analysis.isPure;
  }

  /**
   * Plan the hoisting operation for a variable dependency
   */
  plan(
    dependency: InternalDependency,
    context: HoistContext
  ): HoistPlanItem | null {
    const purityAnalysis = this.analyzePurity(dependency);

    if (purityAnalysis.isPure) {
      return this.planPureVariableHoist(dependency, context);
    } else {
      return this.planImpureVariableHoist(dependency, context, purityAnalysis);
    }
  }

  /**
   * Execute the hoisting operation
   */
  execute(operation: HoistOperation, _context: HoistContext): void {
    // Validation
    if (!operation.dependencyId) {
      throw new Error('Invalid hoist operation: missing dependency ID');
    }
  }

  // ===========================================================================
  // Purity Analysis
  // ===========================================================================

  /**
   * Analyze the purity of a variable
   */
  analyzePurity(dependency: InternalDependency): PurityAnalysis {
    const node = dependency.origin.node;

    if (!node) {
      return {
        isPure: false,
        reason: 'Unable to locate variable declaration node',
      };
    }

    // Handle variable declarator
    if (node.type === 'VariableDeclarator') {
      return this.analyzeVariableDeclarator(node);
    }

    // Handle other node types
    return this.analyzeExpression(node);
  }

  /**
   * Analyze a variable declarator for purity
   */
  private analyzeVariableDeclarator(
    declarator: t.VariableDeclarator
  ): PurityAnalysis {
    const init = declarator.init;

    // Uninitialized variables are considered pure
    if (!init) {
      return { isPure: true };
    }

    return this.analyzeExpression(init);
  }

  /**
   * Analyze an expression for purity
   */
  private analyzeExpression(node: t.Node): PurityAnalysis {
    // Literals are always pure
    if (this.isLiteral(node)) {
      return { isPure: true };
    }

    // Identifiers need to be checked against known impure globals
    if (node.type === 'Identifier') {
      return this.analyzeIdentifier(node);
    }

    // Call expressions need careful analysis
    if (node.type === 'CallExpression') {
      return this.analyzeCallExpression(node);
    }

    // Binary/Unary expressions with pure operands are pure
    if (node.type === 'BinaryExpression' || node.type === 'UnaryExpression') {
      return this.analyzeOperatorExpression(node);
    }

    // Object/Array expressions - recursively check properties
    if (node.type === 'ObjectExpression') {
      return this.analyzeObjectExpression(node);
    }

    if (node.type === 'ArrayExpression') {
      return this.analyzeArrayExpression(node);
    }

    // Arrow functions and function expressions are pure (they don't execute)
    if (
      node.type === 'ArrowFunctionExpression' ||
      node.type === 'FunctionExpression'
    ) {
      return { isPure: true };
    }

    // Template literals - check for expressions
    if (node.type === 'TemplateLiteral') {
      return this.analyzeTemplateLiteral(node);
    }

    // Conditional expressions - check all branches
    if (node.type === 'ConditionalExpression') {
      return this.analyzeConditionalExpression(node);
    }

    // Logical expressions - check both sides
    if (node.type === 'LogicalExpression') {
      const leftPurity = this.analyzeExpression(node.left);
      const rightPurity = this.analyzeExpression(node.right);

      if (!leftPurity.isPure || !rightPurity.isPure) {
        return {
          isPure: false,
          reason: 'Logical expression contains impure operand',
          impureReferences: [
            ...(leftPurity.impureReferences ?? []),
            ...(rightPurity.impureReferences ?? []),
          ],
        };
      }
      return { isPure: true };
    }

    // Member expressions - check if accessing impure properties
    if (node.type === 'MemberExpression') {
      return this.analyzeMemberExpression(node);
    }

    // Default to impure for unknown node types
    return {
      isPure: false,
      reason: `Unknown expression type: ${node.type}`,
    };
  }

  /**
   * Check if a node is a literal value
   */
  private isLiteral(node: t.Node): boolean {
    return (
      node.type === 'StringLiteral' ||
      node.type === 'NumericLiteral' ||
      node.type === 'BooleanLiteral' ||
      node.type === 'NullLiteral' ||
      node.type === 'BigIntLiteral' ||
      node.type === 'RegExpLiteral'
    );
  }

  /**
   * Analyze an identifier for purity
   */
  private analyzeIdentifier(node: t.Identifier): PurityAnalysis {
    const name = node.name;

    // Pure globals
    if (PURE_GLOBALS.has(name)) {
      return { isPure: true };
    }

    // Hook calls are impure
    if (isHookName(name)) {
      return {
        isPure: false,
        reason: `References hook: ${name}`,
        impureReferences: [name],
      };
    }

    // By default, identifiers referencing other variables are considered pure
    // (they just reference the value, not create side effects)
    return { isPure: true };
  }

  /**
   * Analyze a call expression for purity
   */
  private analyzeCallExpression(node: t.CallExpression): PurityAnalysis {
    const callee = node.callee;
    let calleeName = '';

    // Get the callee name for checking
    if (callee.type === 'Identifier') {
      calleeName = callee.name;
    } else if (
      callee.type === 'MemberExpression' &&
      callee.object.type === 'Identifier' &&
      callee.property.type === 'Identifier'
    ) {
      calleeName = `${callee.object.name}.${callee.property.name}`;
    }

    // Check if it's a hook call
    if (isHookName(calleeName)) {
      return {
        isPure: false,
        reason: `Calls hook: ${calleeName}`,
        impureReferences: [calleeName],
      };
    }

    // Check against known impure functions
    if (IMPURE_FUNCTIONS.has(calleeName)) {
      return {
        isPure: false,
        reason: `Calls impure function: ${calleeName}`,
        impureReferences: [calleeName],
      };
    }

    // Some pure function calls
    const pureFunctions = new Set([
      'String',
      'Number',
      'Boolean',
      'parseInt',
      'parseFloat',
      'isNaN',
      'isFinite',
      'encodeURIComponent',
      'decodeURIComponent',
      'encodeURI',
      'decodeURI',
      'JSON.stringify',
      'JSON.parse',
      'Object.keys',
      'Object.values',
      'Object.entries',
      'Object.assign',
      'Object.freeze',
      'Array.isArray',
      'Array.from',
      'Array.of',
      'Math.abs',
      'Math.ceil',
      'Math.floor',
      'Math.round',
      'Math.max',
      'Math.min',
      'Math.pow',
      'Math.sqrt',
      'Math.sin',
      'Math.cos',
      'Math.tan',
    ]);

    if (pureFunctions.has(calleeName)) {
      // Still need to check arguments
      for (const arg of node.arguments) {
        if (arg.type !== 'SpreadElement') {
          const argPurity = this.analyzeExpression(arg);
          if (!argPurity.isPure) {
            return argPurity;
          }
        }
      }
      return { isPure: true };
    }

    // Default: unknown function calls are considered impure
    return {
      isPure: false,
      reason: `Unknown function call: ${calleeName || 'anonymous'}`,
      impureReferences: calleeName ? [calleeName] : undefined,
    };
  }

  /**
   * Analyze operator expression for purity
   */
  private analyzeOperatorExpression(
    node: t.BinaryExpression | t.UnaryExpression
  ): PurityAnalysis {
    if (node.type === 'UnaryExpression') {
      return this.analyzeExpression(node.argument);
    }

    const leftPurity = this.analyzeExpression(node.left);
    const rightPurity = this.analyzeExpression(node.right);

    if (!leftPurity.isPure) {
      return leftPurity;
    }
    if (!rightPurity.isPure) {
      return rightPurity;
    }

    return { isPure: true };
  }

  /**
   * Analyze object expression for purity
   */
  private analyzeObjectExpression(node: t.ObjectExpression): PurityAnalysis {
    for (const prop of node.properties) {
      if (prop.type === 'ObjectProperty') {
        const valuePurity = this.analyzeExpression(prop.value);
        if (!valuePurity.isPure) {
          return valuePurity;
        }
      } else if (prop.type === 'SpreadElement') {
        const spreadPurity = this.analyzeExpression(prop.argument);
        if (!spreadPurity.isPure) {
          return spreadPurity;
        }
      }
      // ObjectMethod is pure (function definition)
    }
    return { isPure: true };
  }

  /**
   * Analyze array expression for purity
   */
  private analyzeArrayExpression(node: t.ArrayExpression): PurityAnalysis {
    for (const element of node.elements) {
      if (element) {
        const expr =
          element.type === 'SpreadElement' ? element.argument : element;
        const elementPurity = this.analyzeExpression(expr);
        if (!elementPurity.isPure) {
          return elementPurity;
        }
      }
    }
    return { isPure: true };
  }

  /**
   * Analyze template literal for purity
   */
  private analyzeTemplateLiteral(node: t.TemplateLiteral): PurityAnalysis {
    for (const expr of node.expressions) {
      const exprPurity = this.analyzeExpression(expr);
      if (!exprPurity.isPure) {
        return exprPurity;
      }
    }
    return { isPure: true };
  }

  /**
   * Analyze conditional expression for purity
   */
  private analyzeConditionalExpression(
    node: t.ConditionalExpression
  ): PurityAnalysis {
    const testPurity = this.analyzeExpression(node.test);
    const consequentPurity = this.analyzeExpression(node.consequent);
    const alternatePurity = this.analyzeExpression(node.alternate);

    if (!testPurity.isPure) return testPurity;
    if (!consequentPurity.isPure) return consequentPurity;
    if (!alternatePurity.isPure) return alternatePurity;

    return { isPure: true };
  }

  /**
   * Analyze member expression for purity
   */
  private analyzeMemberExpression(node: t.MemberExpression): PurityAnalysis {
    // Accessing properties is generally pure
    // But some accesses may trigger getters with side effects
    const objectPurity = this.analyzeExpression(node.object);
    if (!objectPurity.isPure) {
      return objectPurity;
    }

    // Check for known impure property accesses
    if (
      node.object.type === 'Identifier' &&
      node.property.type === 'Identifier'
    ) {
      const accessPath = `${node.object.name}.${node.property.name}`;

      // Date.now, Math.random are impure
      if (accessPath === 'Date.now' || accessPath === 'Math.random') {
        return {
          isPure: false,
          reason: `Accesses impure property: ${accessPath}`,
          impureReferences: [accessPath],
        };
      }
    }

    return { isPure: true };
  }

  // ===========================================================================
  // Hoisting Plans
  // ===========================================================================

  /**
   * Plan hoisting for a pure variable
   */
  private planPureVariableHoist(
    dependency: InternalDependency,
    context: HoistContext
  ): HoistPlanItem {
    // Find appropriate target scope
    const targetScope = this.findOptimalScope(dependency, context);

    const operation = createHoistOperation({
      dependencyId: dependency.id,
      symbol: dependency.symbol,
      fromFile: dependency.origin.file,
      fromScope: dependency.scope.id,
      toFile: context.targetFile,
      toScope: targetScope.id,
      strategy: HoistStrategy.Hoist,
    });

    return {
      dependency,
      operation,
      needsBackwardReference: false,
    };
  }

  /**
   * Plan hoisting for an impure variable (convert to props)
   */
  private planImpureVariableHoist(
    dependency: InternalDependency,
    context: HoistContext,
    _purityAnalysis: PurityAnalysis
  ): HoistPlanItem {
    const operation = createHoistOperation({
      dependencyId: dependency.id,
      symbol: dependency.symbol,
      fromFile: dependency.origin.file,
      fromScope: dependency.scope.id,
      toFile: context.targetFile,
      toScope: context.targetScope.id,
      strategy: HoistStrategy.PassAsProp,
    });

    let propThread;
    if (context.sourceComponent && context.targetComponent) {
      propThread = createPropThreadOperation({
        propName: dependency.symbol,
        valueExpression: dependency.symbol,
        fromComponent: context.sourceComponent.componentName,
        toComponent: context.targetComponent.componentName,
        path: this.getComponentPath(context),
      });
    }

    return {
      dependency,
      operation,
      propThread,
      needsBackwardReference: true,
    };
  }

  /**
   * Find optimal scope for hoisting a variable
   */
  private findOptimalScope(
    dependency: InternalDependency,
    context: HoistContext
  ): ScopeInfo {
    // For pure variables, hoist to the lowest common ancestor of
    // source and target scopes
    // For now, just use target scope
    return context.targetScope;
  }

  /**
   * Get component path for prop threading
   */
  private getComponentPath(context: HoistContext): string[] {
    const path: string[] = [];

    if (context.sourceComponent) {
      path.push(context.sourceComponent.componentName);
    }

    if (
      context.targetComponent &&
      context.targetComponent !== context.sourceComponent
    ) {
      path.push(context.targetComponent.componentName);
    }

    return path;
  }
}

/**
 * Create a new VariableHoister instance
 */
export function createVariableHoister(): VariableHoister {
  return new VariableHoister();
}
