/**
 * SuspenseHandler - Strategy for handling React Suspense boundaries
 *
 * Handles detection and creation of Suspense boundaries when elements
 * containing lazy-loaded components are moved across the component tree.
 */

import traverse from '@babel/traverse';
import type { NodePath } from '@babel/traverse';
import * as t from '@babel/types';

import {
  createHoistOperation,
} from '../types/factories.js';
import {
  HoistStrategy,
} from '../types/internal.js';
import type {
  HoistOperation,
  InternalDependency,
} from '../types/internal.js';
import { DependencyType } from '../types/public.js';

import type {
  HoistContext,
  HoistPlanItem,
  ISuspenseHandler,
} from './types.js';

// ===============================================================================
// Suspense Constants
// ===============================================================================

/**
 * Default fallback component for generated Suspense boundaries
 */
const DEFAULT_FALLBACK_TEXT = 'Loading...';

// ===============================================================================
// SuspenseHandler Class
// ===============================================================================

/**
 * Strategy for handling React Suspense boundaries.
 *
 * Responsibilities:
 * - Detect lazy-loaded components
 * - Find existing Suspense boundaries
 * - Create new Suspense wrappers when needed
 * - Handle nested Suspense boundaries
 */
export class SuspenseHandler implements ISuspenseHandler {
  /**
   * Check if this strategy can handle the given dependency
   */
  canHandle(dependency: InternalDependency): boolean {
    // Suspense handler deals with lazy components which are typically imports
    return dependency.type === DependencyType.Import;
  }

  /**
   * Check if a component is lazy-loaded
   */
  isLazyComponent(path: NodePath): boolean {
    // Check for JSX element with a lazy component reference
    if (path.isJSXElement()) {
      const openingElement = path.node.openingElement;

      if (openingElement.name.type === 'JSXIdentifier') {
        const componentName = openingElement.name.name;

        // Try to find the component declaration
        const binding = path.scope.getBinding(componentName);
        if (binding) {
          return this.isLazyDeclaration(binding.path);
        }
      }
    }

    // Check if the path itself is a lazy declaration
    return this.isLazyDeclaration(path);
  }

  /**
   * Find the parent Suspense boundary
   */
  findSuspenseBoundary(path: NodePath): NodePath | null {
    let current: NodePath | null = path.parentPath;

    while (current !== null) {
      if (this.isSuspenseElement(current)) {
        return current;
      }
      current = current.parentPath;
    }

    return null;
  }

  /**
   * Check if a Suspense boundary is needed at the target
   */
  needsSuspenseBoundary(
    dependency: InternalDependency,
    context: HoistContext
  ): boolean {
    // Check if the dependency involves a lazy component
    const isLazy = this.isDependencyLazy(dependency);
    if (!isLazy) {
      return false;
    }

    // Check if target already has a Suspense boundary
    const targetPath = context.targetScope.path;
    const existingSuspense = this.findSuspenseBoundary(targetPath);
    return existingSuspense === null;
  }

  /**
   * Create a Suspense wrapper operation
   */
  createSuspenseWrapper(
    targetPath: NodePath,
    fallback?: t.Expression
  ): t.JSXElement {
    // Create fallback element if not provided
    const fallbackElement: t.Expression = fallback ?? this.createDefaultFallback();

    // Get the children to wrap
    const children: t.JSXElement['children'] = [];
    if (targetPath.isJSXElement()) {
      children.push(targetPath.node);
    }

    // Create the Suspense element
    return t.jsxElement(
      t.jsxOpeningElement(
        t.jsxIdentifier('Suspense'),
        [
          t.jsxAttribute(
            t.jsxIdentifier('fallback'),
            t.jsxExpressionContainer(fallbackElement)
          ),
        ],
        false
      ),
      t.jsxClosingElement(t.jsxIdentifier('Suspense')),
      children,
      false
    );
  }

  /**
   * Plan the hoisting operation for a lazy component
   */
  plan(
    dependency: InternalDependency,
    context: HoistContext
  ): HoistPlanItem | null {
    const needsSuspense = this.needsSuspenseBoundary(dependency, context);

    const strategy = needsSuspense
      ? HoistStrategy.WrapProvider // Use WrapProvider to indicate wrapping needed
      : HoistStrategy.Hoist;

    const operation = createHoistOperation({
      dependencyId: dependency.id,
      symbol: dependency.symbol,
      fromFile: dependency.origin.file,
      fromScope: dependency.scope.id,
      toFile: context.targetFile,
      toScope: context.targetScope.id,
      strategy,
    });

    return {
      dependency,
      operation,
      needsBackwardReference: false,
      reason: needsSuspense
        ? 'Lazy component requires Suspense boundary at target'
        : undefined,
    };
  }

  /**
   * Execute the hoisting operation
   */
  execute(operation: HoistOperation, _context: HoistContext): void {
    if (!operation.dependencyId) {
      throw new Error('Invalid hoist operation: missing dependency ID');
    }
  }

  // ===========================================================================
  // Lazy Component Detection
  // ===========================================================================

  /**
   * Check if a binding path is a lazy component declaration
   */
  private isLazyDeclaration(path: NodePath): boolean {
    // Check for const LazyComponent = React.lazy(() => import('./Component'))
    if (path.isVariableDeclarator()) {
      const init = path.node.init;
      if (init && this.isLazyCall(init)) {
        return true;
      }
    }

    // Check for const LazyComponent = lazy(() => import('./Component'))
    if (path.isCallExpression()) {
      return this.isLazyCall(path.node);
    }

    return false;
  }

  /**
   * Check if a node is a lazy() call
   */
  private isLazyCall(node: t.Node): boolean {
    if (!t.isCallExpression(node)) {
      return false;
    }

    const callee = node.callee;

    // React.lazy()
    if (
      t.isMemberExpression(callee) &&
      t.isIdentifier(callee.object) &&
      callee.object.name === 'React' &&
      t.isIdentifier(callee.property) &&
      callee.property.name === 'lazy'
    ) {
      return true;
    }

    // lazy()
    if (t.isIdentifier(callee) && callee.name === 'lazy') {
      return true;
    }

    // dynamic() from next/dynamic
    if (t.isIdentifier(callee) && callee.name === 'dynamic') {
      return true;
    }

    // loadable() from @loadable/component
    if (t.isIdentifier(callee) && callee.name === 'loadable') {
      return true;
    }

    return false;
  }

  /**
   * Check if a dependency involves a lazy component
   */
  private isDependencyLazy(dependency: InternalDependency): boolean {
    const node = dependency.origin.node;

    // Check if the dependency's origin node is a lazy declaration
    if (t.isVariableDeclarator(node)) {
      const init = node.init;
      if (init !== null && init !== undefined && this.isLazyCall(init)) {
        return true;
      }
    }

    return false;
  }

  // ===========================================================================
  // Suspense Element Detection
  // ===========================================================================

  /**
   * Check if a path is a Suspense element
   */
  private isSuspenseElement(path: NodePath): boolean {
    if (!path.isJSXElement()) {
      return false;
    }

    const openingElement = path.node.openingElement;

    // <Suspense>
    if (
      t.isJSXIdentifier(openingElement.name) &&
      openingElement.name.name === 'Suspense'
    ) {
      return true;
    }

    // <React.Suspense>
    if (t.isJSXMemberExpression(openingElement.name)) {
      const object = openingElement.name.object;
      const property = openingElement.name.property;

      if (
        t.isJSXIdentifier(object) &&
        object.name === 'React' &&
        t.isJSXIdentifier(property) &&
        property.name === 'Suspense'
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * Create a default fallback element
   */
  private createDefaultFallback(): t.JSXElement {
    return t.jsxElement(
      t.jsxOpeningElement(t.jsxIdentifier('div'), [], true),
      null,
      [t.jsxText(DEFAULT_FALLBACK_TEXT)],
      true
    );
  }

  /**
   * Get fallback from existing Suspense element
   */
  getFallbackFromSuspense(suspensePath: NodePath<t.JSXElement>): t.Expression | null {
    const openingElement = suspensePath.node.openingElement;

    for (const attr of openingElement.attributes) {
      if (
        t.isJSXAttribute(attr) &&
        t.isJSXIdentifier(attr.name) &&
        attr.name.name === 'fallback'
      ) {
        if (attr.value && t.isJSXExpressionContainer(attr.value)) {
          const expr = attr.value.expression;
          if (!t.isJSXEmptyExpression(expr)) {
            return expr;
          }
        }
        if (attr.value && t.isJSXElement(attr.value)) {
          return attr.value;
        }
      }
    }

    return null;
  }
}

/**
 * Create a new SuspenseHandler instance
 */
export function createSuspenseHandler(): SuspenseHandler {
  return new SuspenseHandler();
}

// ===============================================================================
// Utility Functions
// ===============================================================================

/**
 * Check if a node is a React.lazy call
 */
export function isReactLazy(node: t.Node): boolean {
  if (!t.isCallExpression(node)) {
    return false;
  }

  const callee = node.callee;

  if (t.isIdentifier(callee)) {
    return callee.name === 'lazy';
  }

  if (
    t.isMemberExpression(callee) &&
    t.isIdentifier(callee.object) &&
    callee.object.name === 'React' &&
    t.isIdentifier(callee.property) &&
    callee.property.name === 'lazy'
  ) {
    return true;
  }

  return false;
}

/**
 * Check if a node is a dynamic import
 */
export function isDynamicImport(node: t.Node): boolean {
  if (!t.isCallExpression(node)) {
    return false;
  }

  // import() expression
  if (t.isImport(node.callee)) {
    return true;
  }

  return false;
}

/**
 * Find all lazy component declarations in an AST
 */
export function findLazyComponents(
  ast: t.File
): Array<{ name: string; path: NodePath }> {
  const lazyComponents: Array<{ name: string; path: NodePath }> = [];

  traverse(ast, {
    VariableDeclarator(path: NodePath<t.VariableDeclarator>) {
      const init = path.node.init;
      if (init !== null && init !== undefined && isReactLazy(init)) {
        const id = path.node.id;
        if (t.isIdentifier(id)) {
          lazyComponents.push({ name: id.name, path });
        }
      }
    },
  });

  return lazyComponents;
}

/**
 * Find all Suspense boundaries in an AST
 */
export function findSuspenseBoundaries(ast: t.File): NodePath[] {
  const boundaries: NodePath[] = [];

  traverse(ast, {
    JSXElement(path: NodePath<t.JSXElement>) {
      const openingElement = path.node.openingElement;

      // <Suspense>
      if (
        t.isJSXIdentifier(openingElement.name) &&
        openingElement.name.name === 'Suspense'
      ) {
        boundaries.push(path);
        return;
      }

      // <React.Suspense>
      if (t.isJSXMemberExpression(openingElement.name)) {
        const object = openingElement.name.object;
        const property = openingElement.name.property;

        if (
          t.isJSXIdentifier(object) &&
          object.name === 'React' &&
          t.isJSXIdentifier(property) &&
          property.name === 'Suspense'
        ) {
          boundaries.push(path);
        }
      }
    },
  });

  return boundaries;
}

/**
 * Check if a lazy component has a Suspense parent
 */
export function hasParentSuspense(
  lazyPath: NodePath,
  _ast: t.File
): boolean {
  let current: NodePath | null = lazyPath.parentPath;

  while (current !== null) {
    if (current.isJSXElement()) {
      const name = current.node.openingElement.name;

      if (t.isJSXIdentifier(name) && name.name === 'Suspense') {
        return true;
      }

      if (
        t.isJSXMemberExpression(name) &&
        t.isJSXIdentifier(name.object) &&
        name.object.name === 'React' &&
        t.isJSXIdentifier(name.property) &&
        name.property.name === 'Suspense'
      ) {
        return true;
      }
    }

    current = current.parentPath;
  }

  return false;
}

/**
 * Create a Suspense element wrapping the given children
 */
export function createSuspenseElement(
  children: t.JSXElement[],
  fallback?: t.Expression
): t.JSXElement {
  const defaultFallback: t.Expression = t.jsxElement(
    t.jsxOpeningElement(t.jsxIdentifier('div'), [], true),
    null,
    [t.jsxText(DEFAULT_FALLBACK_TEXT)],
    true
  );

  const fallbackExpr: t.Expression = fallback ?? defaultFallback;

  const fallbackAttr = t.jsxAttribute(
    t.jsxIdentifier('fallback'),
    t.jsxExpressionContainer(fallbackExpr)
  );

  return t.jsxElement(
    t.jsxOpeningElement(t.jsxIdentifier('Suspense'), [fallbackAttr], false),
    t.jsxClosingElement(t.jsxIdentifier('Suspense')),
    children,
    false
  );
}
