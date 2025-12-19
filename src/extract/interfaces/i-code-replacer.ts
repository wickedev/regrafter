/**
 * ICodeReplacer interface
 *
 * Replaces selected nodes with a component reference
 */

import type { NodePath } from '@babel/traverse';
import type * as t from '@babel/types';

export interface ICodeReplacer {
  /**
   * Replace selected nodes with a component reference
   *
   * @param ast - AST to modify
   * @param nodes - Nodes to replace
   * @param replacement - Replacement JSX element
   */
  replace(
    ast: t.File,
    nodes: NodePath<t.JSXElement>[],
    replacement: t.JSXElement
  ): void;
}
