/**
 * Atomic Unit Detector Tests
 *
 * Tests for detecting atomic units in JSX code including:
 * - Conditional expressions (condition && element)
 * - Ternary expressions (condition ? A : B)
 * - Map expressions (items.map(...))
 * - Compound components (Tabs.Panel pattern)
 */

import { describe, it, expect } from 'vitest';
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import type { NodePath } from '@babel/traverse';
import type * as t from '@babel/types';

import {
  detectConditionalExpression,
  detectTernaryExpression,
  detectMapExpression,
  detectCompoundComponent,
  detectAtomicUnit,
  getAtomicUnitType,
  findEnclosingAtomicUnit,
  isJSXNode,
  containsJSXElement,
} from '../atomic-unit-detector.js';
import { AtomicUnitType } from '../../types/internal.js';

// Helper function to parse JSX code
function parseJSX(code: string): t.File {
  return parse(code, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript'],
  });
}

// Helper function to find first node of a type
function findFirstNode<T extends t.Node['type']>(
  ast: t.File,
  type: T
): NodePath | null {
  let result: NodePath | null = null;

  traverse(ast, {
    [type](path: NodePath) {
      if (!result) {
        result = path;
        path.stop();
      }
    },
  });

  return result;
}

// Helper function to find all nodes of a type
function findAllNodes<T extends t.Node['type']>(
  ast: t.File,
  type: T
): NodePath[] {
  const results: NodePath[] = [];

  traverse(ast, {
    [type](path: NodePath) {
      results.push(path);
    },
  });

  return results;
}

describe('Atomic Unit Detector', () => {
  // =========================================================================
  // isJSXNode Tests
  // =========================================================================
  describe('isJSXNode', () => {
    it('should identify JSXElement', () => {
      const ast = parseJSX('<div>Hello</div>');
      const node = findFirstNode(ast, 'JSXElement');
      expect(node).not.toBeNull();
      expect(isJSXNode(node!.node)).toBe(true);
    });

    it('should identify JSXFragment', () => {
      const ast = parseJSX('<>Hello</>');
      const node = findFirstNode(ast, 'JSXFragment');
      expect(node).not.toBeNull();
      expect(isJSXNode(node!.node)).toBe(true);
    });

    it('should return false for non-JSX nodes', () => {
      expect(isJSXNode(null)).toBe(false);
      expect(isJSXNode(undefined)).toBe(false);
      expect(isJSXNode({ type: 'Identifier' } as t.Node)).toBe(false);
    });
  });

  // =========================================================================
  // containsJSXElement Tests
  // =========================================================================
  describe('containsJSXElement', () => {
    it('should detect JSX in direct element', () => {
      const ast = parseJSX('<div />');
      const node = findFirstNode(ast, 'JSXElement');
      expect(containsJSXElement(node!.node)).toBe(true);
    });

    it('should detect JSX in logical expression', () => {
      const ast = parseJSX('const x = isVisible && <div />;');
      const node = findFirstNode(ast, 'LogicalExpression');
      expect(node).not.toBeNull();
      expect(containsJSXElement(node!.node)).toBe(true);
    });

    it('should detect JSX in ternary expression', () => {
      const ast = parseJSX('const x = isVisible ? <div /> : null;');
      const node = findFirstNode(ast, 'ConditionalExpression');
      expect(node).not.toBeNull();
      expect(containsJSXElement(node!.node)).toBe(true);
    });

    it('should detect JSX in arrow function', () => {
      const ast = parseJSX('const x = () => <div />;');
      const node = findFirstNode(ast, 'ArrowFunctionExpression');
      expect(node).not.toBeNull();
      expect(containsJSXElement(node!.node)).toBe(true);
    });

    it('should return false when no JSX present', () => {
      const ast = parseJSX('const x = 5 + 3;');
      const node = findFirstNode(ast, 'BinaryExpression');
      expect(node).not.toBeNull();
      expect(containsJSXElement(node!.node)).toBe(false);
    });
  });

  // =========================================================================
  // Conditional Expression Detection Tests
  // =========================================================================
  describe('detectConditionalExpression', () => {
    it('should detect simple conditional rendering', () => {
      const ast = parseJSX('const x = isVisible && <Modal />;');
      const node = findFirstNode(ast, 'LogicalExpression');
      expect(node).not.toBeNull();

      const result = detectConditionalExpression(node!.node);
      expect(result).not.toBeNull();
      expect(result!.condition.type).toBe('Identifier');
      expect(containsJSXElement(result!.element)).toBe(true);
    });

    it('should detect conditional with comparison', () => {
      const ast = parseJSX('const x = items.length > 0 && <List />;');
      const node = findFirstNode(ast, 'LogicalExpression');
      expect(node).not.toBeNull();

      const result = detectConditionalExpression(node!.node);
      expect(result).not.toBeNull();
      expect(result!.condition.type).toBe('BinaryExpression');
    });

    it('should detect nested conditional', () => {
      const ast = parseJSX('const x = user && user.isAdmin && <AdminPanel />;');
      const nodes = findAllNodes(ast, 'LogicalExpression');
      // The outer logical expression should contain JSX
      const outerNode = nodes.find(n => containsJSXElement((n.node as t.LogicalExpression).right));
      expect(outerNode).toBeDefined();

      const result = detectConditionalExpression(outerNode!.node);
      expect(result).not.toBeNull();
    });

    it('should return null for OR expressions', () => {
      const ast = parseJSX('const x = isVisible || <Fallback />;');
      const node = findFirstNode(ast, 'LogicalExpression');
      expect(node).not.toBeNull();

      const result = detectConditionalExpression(node!.node);
      expect(result).toBeNull();
    });

    it('should return null when right side has no JSX', () => {
      const ast = parseJSX('const x = isVisible && someValue;');
      const node = findFirstNode(ast, 'LogicalExpression');
      expect(node).not.toBeNull();

      const result = detectConditionalExpression(node!.node);
      expect(result).toBeNull();
    });
  });

  // =========================================================================
  // Ternary Expression Detection Tests
  // =========================================================================
  describe('detectTernaryExpression', () => {
    it('should detect ternary with JSX in both branches', () => {
      const ast = parseJSX('const x = isLoading ? <Spinner /> : <Content />;');
      const node = findFirstNode(ast, 'ConditionalExpression');
      expect(node).not.toBeNull();

      const result = detectTernaryExpression(node!.node);
      expect(result).not.toBeNull();
      expect(result!.bothBranchesHaveJSX).toBe(true);
    });

    it('should detect ternary with JSX only in consequent', () => {
      const ast = parseJSX('const x = isOpen ? <Modal /> : null;');
      const node = findFirstNode(ast, 'ConditionalExpression');
      expect(node).not.toBeNull();

      const result = detectTernaryExpression(node!.node);
      expect(result).not.toBeNull();
      expect(result!.bothBranchesHaveJSX).toBe(false);
    });

    it('should detect ternary with JSX only in alternate', () => {
      const ast = parseJSX('const x = isLoaded ? data : <Loading />;');
      const node = findFirstNode(ast, 'ConditionalExpression');
      expect(node).not.toBeNull();

      const result = detectTernaryExpression(node!.node);
      expect(result).not.toBeNull();
      expect(result!.bothBranchesHaveJSX).toBe(false);
    });

    it('should return null when no JSX in either branch', () => {
      const ast = parseJSX('const x = isPositive ? 1 : -1;');
      const node = findFirstNode(ast, 'ConditionalExpression');
      expect(node).not.toBeNull();

      const result = detectTernaryExpression(node!.node);
      expect(result).toBeNull();
    });

    it('should include test expression', () => {
      const ast = parseJSX('const x = count > 5 ? <Many /> : <Few />;');
      const node = findFirstNode(ast, 'ConditionalExpression');
      expect(node).not.toBeNull();

      const result = detectTernaryExpression(node!.node);
      expect(result).not.toBeNull();
      expect(result!.test.type).toBe('BinaryExpression');
    });
  });

  // =========================================================================
  // Map Expression Detection Tests
  // =========================================================================
  describe('detectMapExpression', () => {
    it('should detect simple map expression', () => {
      const ast = parseJSX('const x = items.map(item => <Item key={item.id} />);');
      const node = findFirstNode(ast, 'CallExpression');
      expect(node).not.toBeNull();

      const result = detectMapExpression(node!.node);
      expect(result).not.toBeNull();
      expect(result!.mapper.type).toBe('ArrowFunctionExpression');
    });

    it('should detect map with function expression', () => {
      const ast = parseJSX('const x = items.map(function(item) { return <Item />; });');
      const node = findFirstNode(ast, 'CallExpression');
      expect(node).not.toBeNull();

      const result = detectMapExpression(node!.node);
      expect(result).not.toBeNull();
      expect(result!.mapper.type).toBe('FunctionExpression');
    });

    it('should detect map with index parameter', () => {
      const ast = parseJSX('const x = items.map((item, index) => <Item key={index} />);');
      const node = findFirstNode(ast, 'CallExpression');
      expect(node).not.toBeNull();

      const result = detectMapExpression(node!.node);
      expect(result).not.toBeNull();
    });

    it('should return null for filter calls', () => {
      const ast = parseJSX('const x = items.filter(item => item.active);');
      const node = findFirstNode(ast, 'CallExpression');
      expect(node).not.toBeNull();

      const result = detectMapExpression(node!.node);
      expect(result).toBeNull();
    });

    it('should return null when map callback has no JSX', () => {
      const ast = parseJSX('const x = items.map(item => item.name);');
      const node = findFirstNode(ast, 'CallExpression');
      expect(node).not.toBeNull();

      const result = detectMapExpression(node!.node);
      expect(result).toBeNull();
    });

    it('should extract collection from map expression', () => {
      const ast = parseJSX('const x = users.map(user => <User />);');
      const node = findFirstNode(ast, 'CallExpression');
      expect(node).not.toBeNull();

      const result = detectMapExpression(node!.node);
      expect(result).not.toBeNull();
      expect(result!.collection.type).toBe('Identifier');
      expect((result!.collection as t.Identifier).name).toBe('users');
    });
  });

  // =========================================================================
  // Compound Component Detection Tests
  // =========================================================================
  describe('detectCompoundComponent', () => {
    it('should detect Tabs.Panel pattern', () => {
      const ast = parseJSX('<Tabs.Panel>Content</Tabs.Panel>');
      const node = findFirstNode(ast, 'JSXElement');
      expect(node).not.toBeNull();

      const result = detectCompoundComponent(node!.node);
      expect(result).not.toBeNull();
      expect(result!.namespace).toBe('Tabs');
      expect(result!.member).toBe('Panel');
      expect(result!.fullName).toBe('Tabs.Panel');
    });

    it('should detect Menu.Item pattern', () => {
      const ast = parseJSX('<Menu.Item>Click me</Menu.Item>');
      const node = findFirstNode(ast, 'JSXElement');
      expect(node).not.toBeNull();

      const result = detectCompoundComponent(node!.node);
      expect(result).not.toBeNull();
      expect(result!.namespace).toBe('Menu');
      expect(result!.member).toBe('Item');
    });

    it('should detect Form.Field pattern', () => {
      const ast = parseJSX('<Form.Field name="email" />');
      const node = findFirstNode(ast, 'JSXElement');
      expect(node).not.toBeNull();

      const result = detectCompoundComponent(node!.node);
      expect(result).not.toBeNull();
      expect(result!.namespace).toBe('Form');
      expect(result!.member).toBe('Field');
    });

    it('should return null for regular elements', () => {
      const ast = parseJSX('<div>Hello</div>');
      const node = findFirstNode(ast, 'JSXElement');
      expect(node).not.toBeNull();

      const result = detectCompoundComponent(node!.node);
      expect(result).toBeNull();
    });

    it('should return null for simple component elements', () => {
      const ast = parseJSX('<Button>Click</Button>');
      const node = findFirstNode(ast, 'JSXElement');
      expect(node).not.toBeNull();

      const result = detectCompoundComponent(node!.node);
      expect(result).toBeNull();
    });

    it('should handle nested compound patterns', () => {
      const ast = parseJSX('<UI.Components.Button>Click</UI.Components.Button>');
      const node = findFirstNode(ast, 'JSXElement');
      expect(node).not.toBeNull();

      const result = detectCompoundComponent(node!.node);
      expect(result).not.toBeNull();
      expect(result!.namespace).toBe('UI.Components');
      expect(result!.member).toBe('Button');
    });
  });

  // =========================================================================
  // Unified Detection Tests
  // =========================================================================
  describe('detectAtomicUnit', () => {
    it('should detect conditional expression atomic unit', () => {
      const ast = parseJSX('const x = show && <Modal />;');
      const node = findFirstNode(ast, 'LogicalExpression');
      expect(node).not.toBeNull();

      const result = detectAtomicUnit(node!);
      expect(result).not.toBeNull();
      expect(result!.type).toBe(AtomicUnitType.Conditional);
    });

    it('should detect ternary expression atomic unit', () => {
      const ast = parseJSX('const x = loading ? <Spinner /> : <Content />;');
      const node = findFirstNode(ast, 'ConditionalExpression');
      expect(node).not.toBeNull();

      const result = detectAtomicUnit(node!);
      expect(result).not.toBeNull();
      expect(result!.type).toBe(AtomicUnitType.Ternary);
    });

    it('should detect map expression atomic unit', () => {
      const ast = parseJSX('const x = items.map(i => <Item />);');
      const node = findFirstNode(ast, 'CallExpression');
      expect(node).not.toBeNull();

      const result = detectAtomicUnit(node!);
      expect(result).not.toBeNull();
      expect(result!.type).toBe(AtomicUnitType.MapExpression);
    });

    it('should detect compound component atomic unit', () => {
      const ast = parseJSX('<Tabs.Panel>Content</Tabs.Panel>');
      const node = findFirstNode(ast, 'JSXElement');
      expect(node).not.toBeNull();

      const result = detectAtomicUnit(node!);
      expect(result).not.toBeNull();
      expect(result!.type).toBe(AtomicUnitType.CompoundComponent);
    });

    it('should detect simple element atomic unit', () => {
      const ast = parseJSX('<div>Hello</div>');
      const node = findFirstNode(ast, 'JSXElement');
      expect(node).not.toBeNull();

      const result = detectAtomicUnit(node!);
      expect(result).not.toBeNull();
      expect(result!.type).toBe(AtomicUnitType.Element);
    });

    it('should return null for non-JSX nodes', () => {
      const ast = parseJSX('const x = 5;');
      const node = findFirstNode(ast, 'NumericLiteral');
      expect(node).not.toBeNull();

      const result = detectAtomicUnit(node!);
      expect(result).toBeNull();
    });
  });

  // =========================================================================
  // getAtomicUnitType Tests
  // =========================================================================
  describe('getAtomicUnitType', () => {
    it('should return Conditional for && expression with JSX', () => {
      const ast = parseJSX('const x = show && <Modal />;');
      const node = findFirstNode(ast, 'LogicalExpression');
      expect(getAtomicUnitType(node!.node)).toBe(AtomicUnitType.Conditional);
    });

    it('should return Ternary for ternary with JSX', () => {
      const ast = parseJSX('const x = a ? <A /> : <B />;');
      const node = findFirstNode(ast, 'ConditionalExpression');
      expect(getAtomicUnitType(node!.node)).toBe(AtomicUnitType.Ternary);
    });

    it('should return MapExpression for map with JSX', () => {
      const ast = parseJSX('const x = items.map(i => <Item />);');
      const node = findFirstNode(ast, 'CallExpression');
      expect(getAtomicUnitType(node!.node)).toBe(AtomicUnitType.MapExpression);
    });

    it('should return CompoundComponent for compound pattern', () => {
      const ast = parseJSX('<Tabs.Panel />');
      const node = findFirstNode(ast, 'JSXElement');
      expect(getAtomicUnitType(node!.node)).toBe(AtomicUnitType.CompoundComponent);
    });

    it('should return Element for simple JSX', () => {
      const ast = parseJSX('<div />');
      const node = findFirstNode(ast, 'JSXElement');
      expect(getAtomicUnitType(node!.node)).toBe(AtomicUnitType.Element);
    });

    it('should return null for non-JSX', () => {
      expect(getAtomicUnitType(null)).toBeNull();
      expect(getAtomicUnitType(undefined)).toBeNull();
    });
  });

  // =========================================================================
  // findEnclosingAtomicUnit Tests
  // =========================================================================
  describe('findEnclosingAtomicUnit', () => {
    it('should find enclosing conditional for nested JSX', () => {
      const ast = parseJSX('const x = show && <div><span>text</span></div>;');
      // Find the inner span element
      const jsxElements = findAllNodes(ast, 'JSXElement');
      const spanElement = jsxElements.find(p => {
        const node: t.JSXElement = p.node;
        const name = node.openingElement.name;
        return name.type === 'JSXIdentifier' && name.name === 'span';
      });

      expect(spanElement).toBeDefined();

      const result = findEnclosingAtomicUnit(spanElement!);
      expect(result).not.toBeNull();
      expect(result!.type).toBe(AtomicUnitType.Conditional);
    });

    it('should find enclosing map expression', () => {
      const ast = parseJSX('const x = items.map(i => <div><span /></div>);');
      const jsxElements = findAllNodes(ast, 'JSXElement');
      const spanElement = jsxElements.find(p => {
        const node: t.JSXElement = p.node;
        const name = node.openingElement.name;
        return name.type === 'JSXIdentifier' && name.name === 'span';
      });

      expect(spanElement).toBeDefined();

      const result = findEnclosingAtomicUnit(spanElement!);
      expect(result).not.toBeNull();
      expect(result!.type).toBe(AtomicUnitType.MapExpression);
    });

    it('should return null when no special enclosing unit', () => {
      const ast = parseJSX('const x = <div><span /></div>;');
      const jsxElements = findAllNodes(ast, 'JSXElement');
      const spanElement = jsxElements.find(p => {
        const node: t.JSXElement = p.node;
        const name = node.openingElement.name;
        return name.type === 'JSXIdentifier' && name.name === 'span';
      });

      expect(spanElement).toBeDefined();

      const result = findEnclosingAtomicUnit(spanElement!);
      expect(result).toBeNull();
    });
  });
});
