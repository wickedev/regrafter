/**
 * SuspenseHandler - Strategy for handling React Suspense boundaries
 *
 * Handles detection and creation of Suspense boundaries when elements
 * containing lazy-loaded components are moved across the component tree.
 */

import * as t from '@babel/types';
import traverse, { type NodePath } from '@babel/traverse';

import {
  ScopeType,
  HoistStrategy,
} from '../types/internal.js';
import type {
  HoistOperation,
  InternalDependency,
  ScopeInfo,
} from '../types/internal.js';
import { DependencyType } from '../types/public.js';
import {
  createHoistOperation,
  generateId,
} from '../types/factories.js';

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

/**
 * Pattern for detecting lazy function calls
 */
const LAZY_PATTERNS = {
  /** React.lazy() call */
  reactLazy: /^(React\.)?lazy$/,
  /** next/dynamic import */
  nextDynamic: /^dynamic$/,
  /** @loadable/component */
  loadable: /^loadable$/,
};

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
    if (!targetPath) {
      return true; // Assume needed if we can't verify
    }

    const existingSuspense = this.findSuspenseBoundary(targetPath);
    return existingSuspense === null;
  }

  /**
   * Create a Suspense wrapper operation
   */
  createSuspenseWrapper(
    targetPath: NodePath,
    fallback?: t.JSXElement | t.JSXFragment
  ): t.JSXElement {
    // Create fallback element if not provided
    const fallbackElement = fallback || this.createDefaultFallback();

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
            t.jsxExpressionContainer(fallbackElement as t.Expression)
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
  execute(operation: HoistOperation, context: HoistContext): void {
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
    if (node.type !== 'CallExpression') {
      return false;
    }

    const callee = (node as t.CallExpression).callee;

    // React.lazy()
    if (
      callee.type === 'MemberExpression' &&
      callee.object.type === 'Identifier' &&
      callee.object.name === 'React' &&
      callee.property.type === 'Identifier' &&
      callee.property.name === 'lazy'
    ) {
      return true;
    }

    // lazy()
    if (callee.type === 'Identifier' && callee.name === 'lazy') {
      return true;
    }

    // dynamic() from next/dynamic
    if (callee.type === 'Identifier' && callee.name === 'dynamic') {
      return true;
    }

    // loadable() from @loadable/component
    if (callee.type === 'Identifier' && callee.name === 'loadable') {
      return true;
    }

    return false;
  }

  /**
   * Check if a dependency involves a lazy component
   */
  private isDependencyLazy(dependency: InternalDependency): boolean {
    const node = dependency.origin.node;

    if (!node) {
      return false;
    }

    // Check if the dependency's origin node is a lazy declaration
    if (node.type === 'VariableDeclarator') {
      const init = (node as t.VariableDeclarator).init;
      if (init && this.isLazyCall(init)) {
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
      openingElement.name.type === 'JSXIdentifier' &&
      openingElement.name.name === 'Suspense'
    ) {
      return true;
    }

    // <React.Suspense>
    if (openingElement.name.type === 'JSXMemberExpression') {
      const object = openingElement.name.object;
      const property = openingElement.name.property;

      if (
        object.type === 'JSXIdentifier' &&
        object.name === 'React' &&
        property.type === 'JSXIdentifier' &&
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
        attr.type === 'JSXAttribute' &&
        attr.name.type === 'JSXIdentifier' &&
        attr.name.name === 'fallback'
      ) {
        if (attr.value?.type === 'JSXExpressionContainer') {
          return attr.value.expression as t.Expression;
        }
        if (attr.value?.type === 'JSXElement') {
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
  if (node.type !== 'CallExpression') {
    return false;
  }

  const callee = (node as t.CallExpression).callee;

  if (callee.type === 'Identifier') {
    return callee.name === 'lazy';
  }

  if (
    callee.type === 'MemberExpression' &&
    callee.object.type === 'Identifier' &&
    callee.object.name === 'React' &&
    callee.property.type === 'Identifier' &&
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
  if (node.type !== 'CallExpression') {
    return false;
  }

  const call = node as t.CallExpression;

  // import() expression
  if (call.callee.type === 'Import') {
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
      if (init && isReactLazy(init)) {
        const id = path.node.id;
        if (id.type === 'Identifier') {
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
        openingElement.name.type === 'JSXIdentifier' &&
        openingElement.name.name === 'Suspense'
      ) {
        boundaries.push(path);
        return;
      }

      // <React.Suspense>
      if (openingElement.name.type === 'JSXMemberExpression') {
        const object = openingElement.name.object;
        const property = openingElement.name.property;

        if (
          object.type === 'JSXIdentifier' &&
          object.name === 'React' &&
          property.type === 'JSXIdentifier' &&
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
  ast: t.File
): boolean {
  let current: NodePath | null = lazyPath.parentPath;

  while (current !== null) {
    if (current.isJSXElement()) {
      const name = current.node.openingElement.name;

      if (name.type === 'JSXIdentifier' && name.name === 'Suspense') {
        return true;
      }

      if (
        name.type === 'JSXMemberExpression' &&
        name.object.type === 'JSXIdentifier' &&
        name.object.name === 'React' &&
        name.property.type === 'JSXIdentifier' &&
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
  const fallbackAttr = fallback
    ? t.jsxAttribute(
        t.jsxIdentifier('fallback'),
        t.jsxExpressionContainer(fallback)
      )
    : t.jsxAttribute(
        t.jsxIdentifier('fallback'),
        t.jsxExpressionContainer(
          t.jsxElement(
            t.jsxOpeningElement(t.jsxIdentifier('div'), [], true),
            null,
            [t.jsxText(DEFAULT_FALLBACK_TEXT)],
            true
          )
        )
      );

  return t.jsxElement(
    t.jsxOpeningElement(t.jsxIdentifier('Suspense'), [fallbackAttr], false),
    t.jsxClosingElement(t.jsxIdentifier('Suspense')),
    children,
    false
  );
}
