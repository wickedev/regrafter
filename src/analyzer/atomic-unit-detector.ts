/**
 * Atomic Unit Detector
 *
 * Detects atomic units in JSX code that should be moved together as a single unit.
 * Atomic units include:
 * - Conditional expressions: {condition && <Element />}
 * - Ternary expressions: {condition ? <A /> : <B />}
 * - Map expressions: {items.map(item => <Item />)}
 * - Compound components: <Tabs.Panel>, <Menu.Item>
 */

import type { NodePath } from '@babel/traverse';
import * as t from '@babel/types';

import { isJSXNode } from '../core/index.js';
import { createAtomicUnit } from '../types/factories.js';
import { AtomicUnitType } from '../types/internal.js';
import type { AtomicUnit } from '../types/internal.js';

// ============================================================================
// Atomic Unit Type Guards
// ============================================================================

// Re-export isJSXNode from core for backward compatibility (already imported above)
export { isJSXNode };

/**
 * Check if a node is a JSX expression container with JSX content
 */
export function isJSXExpressionWithElement(
  node: t.Node | null | undefined
): node is t.JSXExpressionContainer {
  if (node?.type !== 'JSXExpressionContainer') return false;
  const expr = node.expression;
  if (expr.type === 'JSXEmptyExpression') return false;
  return containsJSXElement(expr);
}

/**
 * Check if an expression contains a JSX element anywhere in its tree
 */
export function containsJSXElement(node: t.Node | null | undefined): boolean {
  if (!node) return false;

  // Direct JSX element
  if (isJSXNode(node)) return true;

  // Logical expression (&&, ||)
  if (node.type === 'LogicalExpression') {
    return containsJSXElement(node.left) || containsJSXElement(node.right);
  }

  // Conditional expression (ternary)
  if (node.type === 'ConditionalExpression') {
    return containsJSXElement(node.consequent) || containsJSXElement(node.alternate);
  }

  // Call expression (could be .map())
  if (node.type === 'CallExpression') {
    // Check arguments for arrow functions returning JSX
    for (const arg of node.arguments) {
      if (containsJSXElement(arg)) return true;
    }
  }

  // Arrow function
  if (node.type === 'ArrowFunctionExpression') {
    return containsJSXElement(node.body);
  }

  // Function expression
  if (node.type === 'FunctionExpression') {
    return containsJSXInFunctionBody(node.body);
  }

  // Block statement
  if (node.type === 'BlockStatement') {
    return containsJSXInFunctionBody(node);
  }

  // Parenthesized expression
  if (node.type === 'ParenthesizedExpression') {
    return containsJSXElement(node.expression);
  }

  return false;
}

/**
 * Check if a function body (BlockStatement) contains JSX in a return statement
 */
function containsJSXInFunctionBody(body: t.BlockStatement): boolean {
  for (const statement of body.body) {
    if (statement.type === 'ReturnStatement' && statement.argument) {
      if (containsJSXElement(statement.argument)) return true;
    }
  }
  return false;
}

// ============================================================================
// Conditional Expression Detection (condition && <Element />)
// ============================================================================

/**
 * Result of conditional expression detection
 */
export interface ConditionalExpressionInfo {
  /** The full logical expression */
  expression: t.LogicalExpression;
  /** The condition part (left side of &&) */
  condition: t.Expression;
  /** The JSX element part (right side of &&) */
  element: t.Expression;
  /** All nodes that make up this atomic unit */
  nodes: t.Node[];
}

/**
 * Detect if a node is a conditional rendering expression (condition && element)
 *
 * @example
 * {isVisible && <Modal />}
 * {user && user.name && <UserProfile />}
 * {items.length > 0 && <List />}
 */
export function detectConditionalExpression(
  node: t.Node | null | undefined
): ConditionalExpressionInfo | null {
  if (!node) return null;

  // Must be a logical expression with && operator
  if (node.type !== 'LogicalExpression' || node.operator !== '&&') {
    return null;
  }

  // The right side must contain JSX
  if (!containsJSXElement(node.right)) {
    return null;
  }

  // Collect all nodes in this atomic unit
  const nodes: t.Node[] = [node];
  collectChildNodes(node, nodes);

  return {
    expression: node,
    condition: node.left,
    element: node.right,
    nodes,
  };
}

/**
 * Check if a NodePath represents a conditional expression atomic unit
 */
export function isConditionalExpressionPath(path: NodePath): boolean {
  return detectConditionalExpression(path.node) !== null;
}

// ============================================================================
// Ternary Expression Detection (condition ? A : B)
// ============================================================================

/**
 * Result of ternary expression detection
 */
export interface TernaryExpressionInfo {
  /** The full conditional expression */
  expression: t.ConditionalExpression;
  /** The test/condition */
  test: t.Expression;
  /** The consequent (truthy branch) */
  consequent: t.Expression;
  /** The alternate (falsy branch) */
  alternate: t.Expression;
  /** Whether both branches contain JSX */
  bothBranchesHaveJSX: boolean;
  /** All nodes that make up this atomic unit */
  nodes: t.Node[];
}

/**
 * Detect if a node is a ternary rendering expression
 *
 * @example
 * {isLoading ? <Spinner /> : <Content />}
 * {isOpen ? <Modal /> : null}
 * {user ? <UserProfile user={user} /> : <LoginForm />}
 */
export function detectTernaryExpression(
  node: t.Node | null | undefined
): TernaryExpressionInfo | null {
  if (!node) return null;

  // Must be a conditional expression
  if (node.type !== 'ConditionalExpression') {
    return null;
  }

  const hasJSXInConsequent = containsJSXElement(node.consequent);
  const hasJSXInAlternate = containsJSXElement(node.alternate);

  // At least one branch must contain JSX
  if (!hasJSXInConsequent && !hasJSXInAlternate) {
    return null;
  }

  // Collect all nodes in this atomic unit
  const nodes: t.Node[] = [node];
  collectChildNodes(node, nodes);

  return {
    expression: node,
    test: node.test,
    consequent: node.consequent,
    alternate: node.alternate,
    bothBranchesHaveJSX: hasJSXInConsequent && hasJSXInAlternate,
    nodes,
  };
}

/**
 * Check if a NodePath represents a ternary expression atomic unit
 */
export function isTernaryExpressionPath(path: NodePath): boolean {
  return detectTernaryExpression(path.node) !== null;
}

// ============================================================================
// Map Expression Detection (items.map(...))
// ============================================================================

/**
 * Result of map expression detection
 */
export interface MapExpressionInfo {
  /** The full call expression */
  expression: t.CallExpression;
  /** The callee (e.g., items.map) */
  callee: t.MemberExpression;
  /** The array/iterable being mapped */
  collection: t.Expression;
  /** The mapping function */
  mapper: t.ArrowFunctionExpression | t.FunctionExpression;
  /** The JSX element being rendered (from mapper body/return) */
  element: t.Expression | null;
  /** All nodes that make up this atomic unit */
  nodes: t.Node[];
}

/**
 * Detect if a node is a map expression that renders JSX
 *
 * @example
 * {items.map(item => <Item key={item.id} />)}
 * {users.map((user, index) => <User key={index} {...user} />)}
 * {data.filter(x => x.active).map(x => <Card data={x} />)}
 */
export function detectMapExpression(
  node: t.Node | null | undefined
): MapExpressionInfo | null {
  if (!node) return null;

  // Must be a call expression
  if (node.type !== 'CallExpression') {
    return null;
  }

  // Callee must be a member expression ending with .map
  if (node.callee.type !== 'MemberExpression') {
    return null;
  }

  const memberExpr = node.callee;
  const property = memberExpr.property;

  // Check if property is 'map'
  if (
    !(property.type === 'Identifier' && property.name === 'map') &&
    !(property.type === 'StringLiteral' && property.value === 'map')
  ) {
    return null;
  }

  // First argument should be a function
  const firstArg = node.arguments[0];
  if (
    !firstArg ||
    (firstArg.type !== 'ArrowFunctionExpression' && firstArg.type !== 'FunctionExpression')
  ) {
    return null;
  }

  const mapper = firstArg;

  // The mapper must return/contain JSX
  if (!containsJSXElement(mapper.body)) {
    return null;
  }

  // Extract the JSX element from the mapper
  const element = extractJSXFromMapper(mapper);

  // Collect all nodes in this atomic unit
  const nodes: t.Node[] = [node];
  collectChildNodes(node, nodes);

  return {
    expression: node,
    callee: memberExpr,
    collection: memberExpr.object,
    mapper,
    element,
    nodes,
  };
}

/**
 * Extract the JSX element from a mapper function
 */
function extractJSXFromMapper(
  mapper: t.ArrowFunctionExpression | t.FunctionExpression
): t.Expression | null {
  const body = mapper.body;

  // Arrow function with expression body
  if (body.type !== 'BlockStatement') {
    if (isJSXNode(body)) return body;
    if (body.type === 'ParenthesizedExpression' && isJSXNode(body.expression)) {
      return body.expression;
    }
    return null;
  }

  // Function with block body - find return statement
  for (const statement of body.body) {
    if (statement.type === 'ReturnStatement' && statement.argument) {
      if (isJSXNode(statement.argument)) {
        return statement.argument;
      }
    }
  }

  return null;
}

/**
 * Check if a NodePath represents a map expression atomic unit
 */
export function isMapExpressionPath(path: NodePath): boolean {
  return detectMapExpression(path.node) !== null;
}

// ============================================================================
// Compound Component Detection (Tabs.Panel pattern)
// ============================================================================

/**
 * Result of compound component detection
 */
export interface CompoundComponentInfo {
  /** The JSX element */
  element: t.JSXElement;
  /** The compound component name (e.g., "Tabs") */
  namespace: string;
  /** The sub-component name (e.g., "Panel") */
  member: string;
  /** Full component name (e.g., "Tabs.Panel") */
  fullName: string;
  /** All nodes that make up this atomic unit */
  nodes: t.Node[];
}

/**
 * Detect if a node is a compound component (Component.SubComponent pattern)
 *
 * @example
 * <Tabs.Panel>...</Tabs.Panel>
 * <Menu.Item>...</Menu.Item>
 * <Form.Field>...</Form.Field>
 * <Accordion.Item>...</Accordion.Item>
 */
export function detectCompoundComponent(
  node: t.Node | null | undefined
): CompoundComponentInfo | null {
  if (!node) return null;

  // Must be a JSX element
  if (node.type !== 'JSXElement') {
    return null;
  }

  const openingElement = node.openingElement;
  const name = openingElement.name;

  // Must be a member expression (Component.SubComponent)
  if (name.type !== 'JSXMemberExpression') {
    return null;
  }

  // Extract the namespace and member
  const { namespace, member } = extractMemberExpressionNames(name);
  if (namespace === null || namespace === '' || member === null || member === '') {
    return null;
  }

  // Collect all nodes in this atomic unit
  const nodes: t.Node[] = [node];
  collectChildNodes(node, nodes);

  return {
    element: node,
    namespace,
    member,
    fullName: `${namespace}.${member}`,
    nodes,
  };
}

/**
 * Extract namespace and member names from a JSX member expression
 */
function extractMemberExpressionNames(
  expr: t.JSXMemberExpression
): { namespace: string | null; member: string | null } {
  // Get the member name (rightmost part)
  // expr.property is always JSXIdentifier per Babel types
  const member = expr.property.name;

  // Get the namespace (could be nested)
  let namespace: string | null = null;
  const object = expr.object;

  if (object.type === 'JSXIdentifier') {
    namespace = object.name;
  } else {
    // object.type === 'JSXMemberExpression' - handle deeper nesting like A.B.C
    const names: string[] = [];
    let current: t.JSXMemberExpression['object'] = object;

    while (current.type === 'JSXMemberExpression') {
      // current.property is always JSXIdentifier per Babel types
      names.unshift(current.property.name);
      current = current.object;
    }

    // After the while loop, current.type === 'JSXIdentifier'
    names.unshift(current.name);

    namespace = names.join('.');
  }

  return { namespace, member };
}

/**
 * Check if a NodePath represents a compound component atomic unit
 */
export function isCompoundComponentPath(path: NodePath): boolean {
  return detectCompoundComponent(path.node) !== null;
}

// ============================================================================
// Unified Atomic Unit Detection
// ============================================================================

/**
 * Detect what type of atomic unit a node represents
 *
 * Returns null if the node is not part of an atomic unit that needs
 * special handling during moves.
 */
export function detectAtomicUnit(path: NodePath): AtomicUnit | null {
  const node = path.node;

  // Check for compound component (JSX member expression)
  const compoundInfo = detectCompoundComponent(node);
  if (compoundInfo) {
    return createAtomicUnit({
      type: AtomicUnitType.CompoundComponent,
      path,
      nodes: compoundInfo.nodes,
    });
  }

  // Check for conditional expression (condition && element)
  const conditionalInfo = detectConditionalExpression(node);
  if (conditionalInfo) {
    return createAtomicUnit({
      type: AtomicUnitType.Conditional,
      path,
      nodes: conditionalInfo.nodes,
    });
  }

  // Check for ternary expression (condition ? A : B)
  const ternaryInfo = detectTernaryExpression(node);
  if (ternaryInfo) {
    return createAtomicUnit({
      type: AtomicUnitType.Ternary,
      path,
      nodes: ternaryInfo.nodes,
    });
  }

  // Check for map expression (items.map(...))
  const mapInfo = detectMapExpression(node);
  if (mapInfo) {
    return createAtomicUnit({
      type: AtomicUnitType.MapExpression,
      path,
      nodes: mapInfo.nodes,
    });
  }

  // Check for plain JSX element
  if (isJSXNode(node)) {
    const nodes: t.Node[] = [node];
    collectChildNodes(node, nodes);
    return createAtomicUnit({
      type: AtomicUnitType.Element,
      path,
      nodes,
    });
  }

  return null;
}

/**
 * Get the atomic unit type for a node
 */
export function getAtomicUnitType(node: t.Node | null | undefined): AtomicUnitType | null {
  if (!node) return null;

  if (detectCompoundComponent(node)) return AtomicUnitType.CompoundComponent;
  if (detectConditionalExpression(node)) return AtomicUnitType.Conditional;
  if (detectTernaryExpression(node)) return AtomicUnitType.Ternary;
  if (detectMapExpression(node)) return AtomicUnitType.MapExpression;
  if (isJSXNode(node)) return AtomicUnitType.Element;

  return null;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Helper to safely get a property value from an object using Reflect API
 */
function getPropertyValue(obj: object, key: string): unknown {
  return Object.prototype.hasOwnProperty.call(obj, key)
    ? Reflect.get(obj, key)
    : undefined;
}

/**
 * Type guard to check if a value is a Node but not a Comment
 * Comments are metadata and should not be included in node collections
 */
function isNodeNotComment(value: unknown): value is t.Node {
  if (!t.isNode(value)) {
    return false;
  }
  // After t.isNode check, we know value is an object with a type property
  // Exclude Comment nodes (CommentBlock and CommentLine)
  // Comments have type 'CommentBlock' or 'CommentLine' which are not part of t.Node union
  if (!('type' in value)) {
    return false;
  }
  const typeValue: unknown = value.type;
  if (typeof typeValue !== 'string') {
    return false;
  }
  return typeValue !== 'CommentBlock' && typeValue !== 'CommentLine';
}

/**
 * Recursively collect all child nodes of a node
 */
function collectChildNodes(node: t.Node, collected: t.Node[]): void {
  // Iterate through node properties to find child nodes
  const keys = Object.keys(node);

  for (const key of keys) {
    // Skip metadata keys and comment properties
    if (
      key === 'type' ||
      key === 'loc' ||
      key === 'start' ||
      key === 'end' ||
      key === 'range' ||
      key === 'leadingComments' ||
      key === 'trailingComments' ||
      key === 'innerComments'
    ) {
      continue;
    }

    const value: unknown = getPropertyValue(node, key);

    if (Array.isArray(value)) {
      for (const item of value) {
        // Check if item is a valid Node (not Comment or other metadata)
        if (item !== null && item !== undefined && typeof item === 'object' && isNodeNotComment(item)) {
          collected.push(item);
          collectChildNodes(item, collected);
        }
      }
    } else if (value !== null && value !== undefined && typeof value === 'object' && isNodeNotComment(value)) {
      // Check if value is a valid Node (not Comment or other metadata)
      collected.push(value);
      collectChildNodes(value, collected);
    }
  }
}

/**
 * Find the enclosing atomic unit for a given path
 *
 * Walks up the AST to find if this node is part of a larger atomic unit
 * (e.g., a JSX element inside a conditional expression)
 */
export function findEnclosingAtomicUnit(path: NodePath): AtomicUnit | null {
  let current: NodePath | null = path;

  while (current) {
    // Check if current node forms an atomic unit
    const atomicUnit = detectAtomicUnit(current);
    if (atomicUnit) {
      // Check if the atomic unit type is one of the special types
      // (not just a plain element)
      if (atomicUnit.type !== AtomicUnitType.Element) {
        return atomicUnit;
      }
    }

    // Move to parent
    current = current.parentPath;

    // Stop at certain boundaries
    if (current?.node) {
      const node = current.node;

      // For arrow functions, check if they're part of a map/forEach call
      // If so, continue searching up
      if (node.type === 'ArrowFunctionExpression') {
        const parent = current.parentPath;
        if (parent?.node.type === 'CallExpression') {
          // This is likely a callback in a call expression, continue searching
          continue;
        }
      }

      // Stop at function/component boundaries
      if (
        node.type === 'FunctionDeclaration' ||
        node.type === 'FunctionExpression' ||
        node.type === 'ArrowFunctionExpression' ||
        node.type === 'ClassMethod' ||
        node.type === 'ClassPrivateMethod'
      ) {
        break;
      }
    }
  }

  return null;
}
