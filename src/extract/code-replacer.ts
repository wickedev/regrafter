/**
 * CodeReplacer
 *
 * Task 7.2: CodeReplacer implementation
 * Replaces original JSX code with component calls
 */

import type { NodePath } from '@babel/traverse';
import * as t from '@babel/types';

import type { ICodeReplacer } from './interfaces/i-code-replacer.js';

/**
 * CodeReplacer
 *
 * Class that replaces original JSX code with new component calls
 *
 * Requirements:
 * - 3.3: Replace JSX code at original location with new component call
 * - 3.6: Generate props passing code
 */
export class CodeReplacer implements ICodeReplacer {
  /**
   * Replace selected nodes with a component reference
   *
   * @param _ast - AST to modify (unused, nodes already contain AST context)
   * @param nodes - Nodes to replace
   * @param replacement - Replacement JSX element
   */
  replace(
    _ast: t.File,
    nodes: Array<NodePath<t.JSXElement>>,
    replacement: t.JSXElement
  ): void {
    // Replace each selected node with the replacement element
    for (const nodePath of nodes) {
      nodePath.replaceWith(t.cloneNode(replacement, true));
    }
  }
}
