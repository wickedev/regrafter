/**
 * PropThreader - Strategy for threading props through component tree
 *
 * Handles prop threading when dependencies need to be passed through
 * intermediate components from source to target.
 */

import type { NodePath } from '@babel/traverse';
import * as t from '@babel/types';

import {
  createPropThreadOperation,
  generateId,
} from '../types/factories.js';
import type {
  ComponentScope,
  InternalDependency,
  PropThreadOperation,
  ScopeInfo,
} from '../types/internal.js';

import type {
  HoistContext,
  IPropThreader,
} from './types.js';

// ===============================================================================
// Prop Naming Constants
// ===============================================================================

/**
 * Reserved prop names that should not be used
 */
const RESERVED_PROP_NAMES = new Set([
  'key',
  'ref',
  'children',
  '__self',
  '__source',
]);

/**
 * Common prop name suffixes for disambiguation
 */
const PROP_SUFFIXES = ['Prop', 'Value', 'Data', 'Item'];

// ===============================================================================
// PropThreader Class
// ===============================================================================

/**
 * Strategy for threading props through component trees.
 *
 * Responsibilities:
 * - Calculate component paths from source to target
 * - Generate prop threading operations
 * - Resolve prop name conflicts
 * - Handle TypeScript prop type additions
 */
export class PropThreader implements IPropThreader {
  /**
   * Calculate the component path from source to target
   *
   * Finds the path of components that props need to be threaded through
   * to get from the source component to the target component.
   */
  calculateComponentPath(
    sourceComponent: ComponentScope,
    targetComponent: ComponentScope
  ): ComponentScope[] {
    // If same component, no path needed
    if (sourceComponent.id === targetComponent.id) {
      return [];
    }

    // Build ancestor chains
    const sourceAncestors = this.getAncestorChain(sourceComponent);
    const targetAncestors = this.getAncestorChain(targetComponent);

    // Find lowest common ancestor
    const lcaIndex = this.findLowestCommonAncestorIndex(
      sourceAncestors,
      targetAncestors
    );

    // Build path from source to LCA to target
    const path: ComponentScope[] = [];

    // Add source ancestors up to (but not including) LCA
    for (let i = 0; i < sourceAncestors.length - lcaIndex; i++) {
      path.push(sourceAncestors[i]);
    }

    // Add target ancestors from LCA down to target
    for (let i = targetAncestors.length - lcaIndex - 1; i >= 0; i--) {
      path.push(targetAncestors[i]);
    }

    return path;
  }

  /**
   * Create prop threading operations for a dependency
   */
  createPropThread(
    dependency: InternalDependency,
    componentPath: ComponentScope[],
    propName?: string
  ): PropThreadOperation[] {
    if (componentPath.length < 2) {
      return [];
    }

    const operations: PropThreadOperation[] = [];
    const name = propName || this.generatePropName(dependency);

    // Create a prop thread operation for each hop in the path
    for (let i = 0; i < componentPath.length - 1; i++) {
      const fromComponent = componentPath[i];
      const toComponent = componentPath[i + 1];

      operations.push(
        createPropThreadOperation({
          propName: name,
          valueExpression: name,
          fromComponent: fromComponent.componentName,
          toComponent: toComponent.componentName,
          path: componentPath.map((c) => c.componentName),
        })
      );
    }

    return operations;
  }

  /**
   * Resolve prop name conflicts
   */
  resolveNameConflict(propName: string, existingProps: Set<string>): string {
    // Check if name is reserved
    if (RESERVED_PROP_NAMES.has(propName)) {
      propName = `${propName}Value`;
    }

    // If no conflict, return as-is
    if (!existingProps.has(propName)) {
      return propName;
    }

    // Try adding suffixes
    for (const suffix of PROP_SUFFIXES) {
      const newName = `${propName}${suffix}`;
      if (!existingProps.has(newName)) {
        return newName;
      }
    }

    // Add numeric suffix
    let counter = 2;
    while (existingProps.has(`${propName}${counter}`)) {
      counter++;
    }

    return `${propName}${counter}`;
  }

  /**
   * Plan complete prop threading for a context
   */
  planPropThreading(
    dependency: InternalDependency,
    context: HoistContext,
    existingProps?: Set<string>
  ): PropThreadOperation[] {
    if (!context.sourceComponent || !context.targetComponent) {
      return [];
    }

    const componentPath = this.calculateComponentPath(
      context.sourceComponent,
      context.targetComponent
    );

    if (componentPath.length < 2) {
      return [];
    }

    // Generate prop name with conflict resolution
    let propName = this.generatePropName(dependency);
    if (existingProps) {
      propName = this.resolveNameConflict(propName, existingProps);
    }

    return this.createPropThread(dependency, componentPath, propName);
  }

  /**
   * Check if a component already has a prop with the given name
   */
  componentHasProp(component: ComponentScope, propName: string): boolean {
    // Check if the binding exists in the component's scope
    return component.bindings.has(propName);
  }

  /**
   * Get all existing prop names for a component
   */
  getExistingProps(component: ComponentScope): Set<string> {
    const props = new Set<string>();

    // Add bindings that are props (from component parameters)
    for (const [name, binding] of component.bindings) {
      if (binding.kind === 'param') {
        props.add(name);
      }
    }

    return props;
  }

  /**
   * Merge multiple prop threading operations that share the same hop
   */
  mergeThreadOperations(
    operations: PropThreadOperation[]
  ): PropThreadOperation[] {
    // Group by from/to component pairs
    const grouped = new Map<string, PropThreadOperation[]>();

    for (const op of operations) {
      const key = `${op.fromComponent}:${op.toComponent}`;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(op);
    }

    // Merge operations with same hop
    const merged: PropThreadOperation[] = [];

    for (const [, ops] of grouped) {
      if (ops.length === 1) {
        merged.push(ops[0]);
      } else {
        // Create a combined operation
        // In practice, each prop will have its own attribute, but
        // we track them together for efficiency
        merged.push(...ops); // Keep separate for now
      }
    }

    return merged;
  }

  /**
   * Generate JSX attributes for prop threading
   */
  generateJSXAttributes(operation: PropThreadOperation): t.JSXAttribute {
    return t.jsxAttribute(
      t.jsxIdentifier(operation.propName),
      t.jsxExpressionContainer(t.identifier(operation.propName))
    );
  }

  /**
   * Generate destructured prop parameter
   */
  generatePropParameter(propName: string): t.ObjectProperty {
    return t.objectProperty(
      t.identifier(propName),
      t.identifier(propName),
      false,
      true // shorthand
    );
  }

  /**
   * Generate TypeScript prop type declaration
   */
  generatePropType(
    propName: string,
    propType: string = 'unknown'
  ): t.TSPropertySignature {
    return t.tsPropertySignature(
      t.identifier(propName),
      t.tsTypeAnnotation(
        propType === 'unknown'
          ? t.tsUnknownKeyword()
          : t.tsTypeReference(t.identifier(propType))
      )
    );
  }

  // ===========================================================================
  // Helper Methods
  // ===========================================================================

  /**
   * Get ancestor chain for a component (from component up to root)
   */
  private getAncestorChain(component: ComponentScope): ComponentScope[] {
    const chain: ComponentScope[] = [];
    let current: ComponentScope | null = component;

    while (current !== null) {
      chain.push(current);
      current = current.parentComponent;
    }

    return chain;
  }

  /**
   * Find the index of the lowest common ancestor
   */
  private findLowestCommonAncestorIndex(
    chain1: ComponentScope[],
    chain2: ComponentScope[]
  ): number {
    // Create a set of IDs from chain1
    const chain1Ids = new Set(chain1.map((c) => c.id));

    // Find first component in chain2 that's in chain1
    for (let i = 0; i < chain2.length; i++) {
      if (chain1Ids.has(chain2[i].id)) {
        // Return position in chain1
        return chain1.findIndex((c) => c.id === chain2[i].id);
      }
    }

    // No common ancestor found (shouldn't happen in valid tree)
    return chain1.length - 1;
  }

  /**
   * Generate a prop name from a dependency
   */
  private generatePropName(dependency: InternalDependency): string {
    // Use the symbol name, converting if needed
    let name = dependency.symbol;

    // Handle destructured patterns
    if (name.includes('[') || name.includes('{')) {
      // Extract first identifier from pattern
      const match = name.match(/[a-zA-Z_$][a-zA-Z0-9_$]*/);
      if (match) {
        name = match[0];
      }
    }

    // Ensure valid JavaScript identifier
    name = this.sanitizePropName(name);

    return name;
  }

  /**
   * Sanitize a name to be a valid prop name
   */
  private sanitizePropName(name: string): string {
    // Remove invalid characters
    name = name.replace(/[^a-zA-Z0-9_$]/g, '');

    // Ensure it doesn't start with a number
    if (/^[0-9]/.test(name)) {
      name = `_${name}`;
    }

    // Ensure it's not empty
    if (!name) {
      name = 'prop';
    }

    return name;
  }
}

/**
 * Create a new PropThreader instance
 */
export function createPropThreader(): PropThreader {
  return new PropThreader();
}

// ===============================================================================
// Utility Functions
// ===============================================================================

/**
 * Check if two component scopes share a common ancestor
 */
export function hasCommonAncestor(
  component1: ComponentScope,
  component2: ComponentScope
): boolean {
  const ancestors1 = new Set<string>();
  let current: ComponentScope | null = component1;

  while (current !== null) {
    ancestors1.add(current.id);
    current = current.parentComponent;
  }

  current = component2;
  while (current !== null) {
    if (ancestors1.has(current.id)) {
      return true;
    }
    current = current.parentComponent;
  }

  return false;
}

/**
 * Find the lowest common ancestor of two components
 */
export function findLowestCommonAncestor(
  component1: ComponentScope,
  component2: ComponentScope
): ComponentScope | null {
  const ancestors1 = new Map<string, ComponentScope>();
  let current: ComponentScope | null = component1;

  while (current !== null) {
    ancestors1.set(current.id, current);
    current = current.parentComponent;
  }

  current = component2;
  while (current !== null) {
    if (ancestors1.has(current.id)) {
      return ancestors1.get(current.id)!;
    }
    current = current.parentComponent;
  }

  return null;
}

/**
 * Calculate the depth of a component in the tree
 */
export function getComponentDepth(component: ComponentScope): number {
  let depth = 0;
  let current: ComponentScope | null = component.parentComponent;

  while (current !== null) {
    depth++;
    current = current.parentComponent;
  }

  return depth;
}
