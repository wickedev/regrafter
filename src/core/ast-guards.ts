/**
 * AST Type Guards
 *
 * Centralized type guards for Babel AST node type checking.
 * Consolidates duplicated isJSX* functions from across the codebase.
 *
 * @module core/ast-guards
 */

import type * as t from '@babel/types';

/**
 * Check if a node is a JSX element or fragment
 *
 * This is the most strict JSX check - only actual renderable JSX nodes.
 * Use this when you want to identify React elements specifically.
 *
 * @param node - AST node to check
 * @returns true if node is JSXElement or JSXFragment
 */
export function isJSXNode(
  node: t.Node | null | undefined
): node is t.JSXElement | t.JSXFragment {
  if (!node) return false;
  return node.type === 'JSXElement' || node.type === 'JSXFragment';
}

/**
 * Check if a node is any JSX-related node type
 *
 * This checks for all JSX node types including containers and text.
 * Use this when you want to identify any JSX-related syntax.
 *
 * @param node - AST node to check
 * @returns true if node is any JSX type
 */
export function isAnyJSXNode(
  node: t.Node | null | undefined
): boolean {
  if (!node) return false;
  return (
    node.type === 'JSXElement' ||
    node.type === 'JSXFragment' ||
    node.type === 'JSXText' ||
    node.type === 'JSXExpressionContainer' ||
    node.type === 'JSXSpreadChild'
  );
}

/**
 * Check if a node is a JSX element
 *
 * @param node - AST node to check
 * @returns true if node is JSXElement
 */
export function isJSXElement(
  node: t.Node | null | undefined
): node is t.JSXElement {
  if (!node) return false;
  return node.type === 'JSXElement';
}

/**
 * Check if a node is a JSX fragment
 *
 * @param node - AST node to check
 * @returns true if node is JSXFragment
 */
export function isJSXFragment(
  node: t.Node | null | undefined
): node is t.JSXFragment {
  if (!node) return false;
  return node.type === 'JSXFragment';
}

/**
 * Check if a node is a JSX expression container
 *
 * @param node - AST node to check
 * @returns true if node is JSXExpressionContainer
 */
export function isJSXExpressionContainer(
  node: t.Node | null | undefined
): node is t.JSXExpressionContainer {
  if (!node) return false;
  return node.type === 'JSXExpressionContainer';
}

/**
 * Check if a node is JSX text
 *
 * @param node - AST node to check
 * @returns true if node is JSXText
 */
export function isJSXText(
  node: t.Node | null | undefined
): node is t.JSXText {
  if (!node) return false;
  return node.type === 'JSXText';
}
