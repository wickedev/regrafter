/**
 * Fast canMove Analysis
 *
 * Provides a fast path for checking if an element can be moved without
 * performing the full transformation. Uses early return on blocking issues
 * for optimal performance.
 */

import type { NodePath } from '@babel/traverse';
import traverseModule from '@babel/traverse';
import type * as t from '@babel/types';

import type { Parser} from '../parser/index.js';
import { createParser } from '../parser/index.js';
import type { FileInput } from '../types/public.js';
import { loadTraverseFunction } from '../utils/index.js';

const traverse = loadTraverseFunction(traverseModule);

import type {
  FastCanMoveResult,
  FastCanMoveOptions,
  BlockingIssue,
} from './types.js';

/**
 * Default options for fast canMove analysis.
 */
const DEFAULT_FAST_CANMOVE_OPTIONS: Required<FastCanMoveOptions> = {
  skipDetailedChecks: false,
  timeout: 100,
  checkHookRules: true,
  checkCircularDeps: true,
};

/**
 * FastCanMove provides quick validation of move operations.
 */
export class FastCanMove {
  private readonly parser: Parser;
  private readonly hookNames: Set<string>;

  constructor() {
    this.parser = createParser();
    // Common React hooks
    this.hookNames = new Set([
      'useState',
      'useEffect',
      'useContext',
      'useReducer',
      'useCallback',
      'useMemo',
      'useRef',
      'useImperativeHandle',
      'useLayoutEffect',
      'useDebugValue',
      'useDeferredValue',
      'useTransition',
      'useId',
      'useSyncExternalStore',
      'useInsertionEffect',
    ]);
  }

  /**
   * Perform fast canMove analysis.
   *
   * @param files - Input files
   * @param from - Source selector
   * @param to - Target selector
   * @param options - Analysis options
   * @returns Fast canMove result
   */
  analyze(
    files: FileInput[],
    from: { file: string; path: string },
    to: { file: string; path: string },
    options?: FastCanMoveOptions
  ): FastCanMoveResult {
    const startTime = performance.now();
    const opts = { ...DEFAULT_FAST_CANMOVE_OPTIONS, ...options };
    const blockingIssues: BlockingIssue[] = [];
    let complexityEstimate = 0;

    // Check for timeout
    const checkTimeout = (): boolean => {
      return performance.now() - startTime > opts.timeout;
    };

    try {
      // Parse source file
      const sourceFile = files.find((f) => f.path === from.file);
      if (!sourceFile) {
        blockingIssues.push({
          type: 'source_not_found',
          description: `Source file not found: ${from.file}`,
          severity: 'error',
        });
        return this.buildResult(false, blockingIssues, 0, startTime);
      }

      // Parse target file
      const targetFile = files.find((f) => f.path === to.file);
      if (!targetFile) {
        blockingIssues.push({
          type: 'target_not_found',
          description: `Target file not found: ${to.file}`,
          severity: 'error',
        });
        return this.buildResult(false, blockingIssues, 0, startTime);
      }

      // Parse ASTs
      const sourceResult = this.parser.parse(sourceFile.content, sourceFile.path);
      if (!sourceResult.success || !sourceResult.ast) {
        blockingIssues.push({
          type: 'source_not_found',
          description: `Failed to parse source file: ${from.file}`,
          severity: 'error',
        });
        return this.buildResult(false, blockingIssues, 0, startTime);
      }

      const targetResult = this.parser.parse(targetFile.content, targetFile.path);
      if (!targetResult.success || !targetResult.ast) {
        blockingIssues.push({
          type: 'target_not_found',
          description: `Failed to parse target file: ${to.file}`,
          severity: 'error',
        });
        return this.buildResult(false, blockingIssues, 0, startTime);
      }

      if (checkTimeout()) {
        return this.buildResult(true, blockingIssues, complexityEstimate, startTime, true);
      }

      // Find source element
      const sourceNode = this.findNodeByPath(sourceResult.ast, from.path);
      if (!sourceNode) {
        blockingIssues.push({
          type: 'source_not_found',
          description: `Source element not found at path: ${from.path}`,
          severity: 'error',
        });
        return this.buildResult(false, blockingIssues, 0, startTime);
      }

      // Find target element
      const targetNode = this.findNodeByPath(targetResult.ast, to.path);
      if (!targetNode) {
        blockingIssues.push({
          type: 'target_not_found',
          description: `Target element not found at path: ${to.path}`,
          severity: 'error',
        });
        return this.buildResult(false, blockingIssues, 0, startTime);
      }

      if (checkTimeout()) {
        return this.buildResult(true, blockingIssues, complexityEstimate, startTime, true);
      }

      // Check hook rules (fast check)
      if (opts.checkHookRules && !opts.skipDetailedChecks) {
        const hookIssues = this.checkHookRules(sourceNode, targetResult.ast);
        blockingIssues.push(...hookIssues);
        if (hookIssues.some((i) => i.severity === 'error')) {
          return this.buildResult(false, blockingIssues, complexityEstimate, startTime);
        }
        complexityEstimate += hookIssues.length * 0.2;
      }

      if (checkTimeout()) {
        return this.buildResult(true, blockingIssues, complexityEstimate, startTime, true);
      }

      // Check for unanalyzable code (fast check)
      const unanalyzableIssues = this.checkUnanalyzableCode(sourceNode);
      blockingIssues.push(...unanalyzableIssues);
      if (unanalyzableIssues.some((i) => i.severity === 'error')) {
        return this.buildResult(false, blockingIssues, complexityEstimate, startTime);
      }

      if (checkTimeout()) {
        return this.buildResult(true, blockingIssues, complexityEstimate, startTime, true);
      }

      // Check scope escape (fast check)
      const scopeIssues = this.checkScopeEscape(sourceNode);
      blockingIssues.push(...scopeIssues);
      complexityEstimate += scopeIssues.length * 0.15;

      // Estimate complexity based on element size and dependencies
      complexityEstimate += this.estimateComplexity(sourceNode);
      complexityEstimate = Math.min(1, complexityEstimate);

      // Determine if move is possible
      const canMove = !blockingIssues.some((i) => i.severity === 'error');

      return this.buildResult(
        canMove,
        blockingIssues,
        complexityEstimate,
        startTime,
        complexityEstimate > 0.7
      );
    } catch (error) {
      blockingIssues.push({
        type: 'unanalyzable_code',
        description: `Analysis error: ${error instanceof Error ? error.message : String(error)}`,
        severity: 'error',
      });
      return this.buildResult(false, blockingIssues, 0, startTime);
    }
  }

  /**
   * Check if a custom hook name (starts with 'use').
   */
  isHookName(name: string): boolean {
    return this.hookNames.has(name) || /^use[A-Z]/.test(name);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Private Helper Methods
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Safely access a property on an object using proper type guards
   */
  private getProperty(obj: unknown, key: string): unknown {
    if (typeof obj !== 'object' || obj === null) {
      return undefined;
    }
    if (!(key in obj)) {
      return undefined;
    }
    // Use Reflect.get to avoid indexing errors
    return Reflect.get(obj, key);
  }

  private buildResult(
    canMove: boolean,
    blockingIssues: BlockingIssue[],
    complexityEstimate: number,
    startTime: number,
    needsDetailedAnalysis = false
  ): FastCanMoveResult {
    return {
      canMove,
      blockingIssues,
      complexityEstimate,
      needsDetailedAnalysis: needsDetailedAnalysis || complexityEstimate > 0.5,
      analysisTimeMs: performance.now() - startTime,
    };
  }

  /**
   * Get the Program NodePath from an AST
   */
  private getProgramPath(ast: t.File): NodePath {
    const found: { path: NodePath | null } = { path: null };
    traverse(ast, {
      Program(nodePath: NodePath<t.Program>) {
        found.path = nodePath;
        nodePath.stop();
      },
    });
    // Program visitor always executes for valid ASTs
    // Use object wrapper to avoid ESLint unnecessary-condition warning
    const result = found.path;
    if (result === null) {
      throw new Error('Failed to find Program node in AST');
    }
    return result;
  }

  private findNodeByPath(ast: t.File, path: string): NodePath | null {
    // Parse path like "Program.body[0].declaration.body.body[2]"
    const parts = path.split('.').flatMap((p) => {
      const match = p.match(/^(\w+)(?:\[(\d+)\])?$/);
      if (!match) return [p];
      const [, name, index] = match;
      if (index !== undefined && name !== undefined && name !== '') {
        return [name, parseInt(index, 10)];
      }
      if (name !== undefined && name !== '') {
        return [name];
      }
      return [p];
    });

    // Get the Program NodePath
    let currentPath: NodePath;
    try {
      currentPath = this.getProgramPath(ast);
    } catch {
      return null;
    }

    // Navigate path
    for (let i = 1; i < parts.length; i++) {
      // Skip 'Program'
      const part = parts[i];

      if (typeof part === 'number') {
        // Array index - get the property name from previous part
        const prevPart = parts[i - 1];
        if (typeof prevPart !== 'string') {
          return null;
        }
        const propertyName = prevPart;

        // Type guard: access property safely
        const containerValue: unknown = this.getProperty(currentPath.node, propertyName);

        // Type guard: verify it's an array
        if (!Array.isArray(containerValue) || part >= containerValue.length) {
          return null;
        }

        const targetNodeValue: unknown = containerValue[part];
        if (targetNodeValue === null || targetNodeValue === undefined) {
          return null;
        }

        // Find the NodePath for this index by traversing children
        const searchTarget = targetNodeValue;
        const found: { path: NodePath | null } = { path: null };
        currentPath.traverse({
          enter(childPath: NodePath) {
            if (childPath.node === searchTarget) {
              found.path = childPath;
              childPath.stop();
            }
          },
        });

        // If we didn't find the child path, return null
        const foundPath = found.path;
        if (foundPath === null) {
          return null;
        }
        currentPath = foundPath;
      } else if (typeof part === 'string' && !/^\d+$/.test(part)) {
        // Property access - check if next part is an array index
        const nextPart = parts[i + 1];
        if (typeof nextPart === 'number') {
          // Skip this part - will be handled together with the index in next iteration
          continue;
        }

        // Regular property access using helper
        const nodeValue: unknown = this.getProperty(currentPath.node, part);

        // Type guard: verify it's an object
        if (nodeValue === null || nodeValue === undefined || typeof nodeValue !== 'object') {
          return null;
        }

        // Find the NodePath for this property by traversing children
        const searchTarget = nodeValue;
        const found: { path: NodePath | null } = { path: null };
        currentPath.traverse({
          enter(childPath: NodePath) {
            if (childPath.node === searchTarget) {
              found.path = childPath;
              childPath.stop();
            }
          },
        });

        // If we didn't find the child path, return null
        const foundPath = found.path;
        if (foundPath === null) {
          return null;
        }
        currentPath = foundPath;
      }
    }

    return currentPath;
  }

  private checkHookRules(sourcePath: NodePath, targetAst: t.File): BlockingIssue[] {
    const issues: BlockingIssue[] = [];
    const hooksUsed: Array<{ name: string; location?: t.SourceLocation | null }> = [];

    // Find hooks used in source element
    sourcePath.traverse({
      CallExpression: (path: NodePath<t.CallExpression>) => {
        const callee = path.node.callee;
        if (callee.type === 'Identifier' && this.isHookName(callee.name)) {
          hooksUsed.push({
            name: callee.name,
            location: path.node.loc,
          });
        }
      },
    });

    if (hooksUsed.length === 0) {
      return issues;
    }

    // Check if target is inside a conditional or loop
    const targetFlags = { hasConditional: false, hasLoop: false };

    traverse(targetAst, {
      IfStatement(path: NodePath<t.IfStatement>) {
        targetFlags.hasConditional = true;
        path.skip();
      },
      ConditionalExpression(path: NodePath<t.ConditionalExpression>) {
        targetFlags.hasConditional = true;
        path.skip();
      },
      ForStatement(path: NodePath<t.ForStatement>) {
        targetFlags.hasLoop = true;
        path.skip();
      },
      WhileStatement(path: NodePath<t.WhileStatement>) {
        targetFlags.hasLoop = true;
        path.skip();
      },
      DoWhileStatement(path: NodePath<t.DoWhileStatement>) {
        targetFlags.hasLoop = true;
        path.skip();
      },
    });

    if (targetFlags.hasConditional) {
      for (const hook of hooksUsed) {
        issues.push({
          type: 'conditional_hook',
          description: `Hook ${hook.name} would be called conditionally after move`,
          severity: 'error',
          location: hook.location,
        });
      }
    }

    if (targetFlags.hasLoop) {
      for (const hook of hooksUsed) {
        issues.push({
          type: 'hook_rule_violation',
          description: `Hook ${hook.name} would be called inside a loop after move`,
          severity: 'error',
          location: hook.location,
        });
      }
    }

    return issues;
  }

  private checkUnanalyzableCode(sourcePath: NodePath): BlockingIssue[] {
    const issues: BlockingIssue[] = [];

    sourcePath.traverse({
      // Check for eval
      CallExpression(path: NodePath<t.CallExpression>) {
        const callee = path.node.callee;
        if (callee.type === 'Identifier' && callee.name === 'eval') {
          issues.push({
            type: 'unanalyzable_code',
            description: 'Element contains eval() which cannot be analyzed',
            severity: 'error',
            location: path.node.loc,
          });
        }
      },

      // Check for with statements
      WithStatement(path: NodePath<t.WithStatement>) {
        issues.push({
          type: 'unanalyzable_code',
          description: 'Element contains with statement which cannot be analyzed',
          severity: 'error',
          location: path.node.loc,
        });
      },

      // Check for dynamic property access on unknown objects
      MemberExpression(path: NodePath<t.MemberExpression>) {
        if (path.node.computed && path.node.property.type !== 'StringLiteral') {
          // Dynamic property access - warning, not error
          issues.push({
            type: 'unanalyzable_code',
            description: 'Element contains dynamic property access',
            severity: 'warning',
            location: path.node.loc,
          });
        }
      },
    });

    return issues;
  }

  private checkScopeEscape(sourcePath: NodePath): BlockingIssue[] {
    const issues: BlockingIssue[] = [];
    const referencedIdentifiers = new Set<string>();
    const declaredIdentifiers = new Set<string>();

    // Collect all references and declarations
    sourcePath.traverse({
      Identifier(path: NodePath<t.Identifier>) {
        if (path.isReferencedIdentifier()) {
          referencedIdentifiers.add(path.node.name);
        }
      },
      VariableDeclarator(path: NodePath<t.VariableDeclarator>) {
        const id = path.node.id;
        if (id.type === 'Identifier') {
          declaredIdentifiers.add(id.name);
        }
      },
      FunctionDeclaration(path: NodePath<t.FunctionDeclaration>) {
        if (path.node.id) {
          declaredIdentifiers.add(path.node.id.name);
        }
      },
    });

    // Check for references to parent scope
    for (const name of Array.from(referencedIdentifiers)) {
      if (!declaredIdentifiers.has(name)) {
        // Check if this is a global or import
        const binding = sourcePath.scope.getBinding(name);
        if (binding !== undefined && !binding.path.isImportSpecifier()) {
          // This references a parent scope variable
          issues.push({
            type: 'scope_escape',
            description: `Element references '${name}' from parent scope`,
            severity: 'warning',
          });
        }
      }
    }

    return issues;
  }

  private estimateComplexity(sourcePath: NodePath): number {
    let nodeCount = 0;
    let hookCount = 0;
    let jsxDepth = 0;
    let maxJsxDepth = 0;

    sourcePath.traverse({
      CallExpression: (path: NodePath<t.CallExpression>) => {
        nodeCount++; // Count all nodes via specific visitors
        const callee = path.node.callee;
        if (callee.type === 'Identifier' && this.isHookName(callee.name)) {
          hookCount++;
        }
      },
      Identifier: (_path: NodePath<t.Identifier>) => {
        nodeCount++;
      },
      JSXElement: {
        enter: (_path: NodePath<t.JSXElement>) => {
          nodeCount++;
          jsxDepth++;
          maxJsxDepth = Math.max(maxJsxDepth, jsxDepth);
        },
        exit: (_path: NodePath<t.JSXElement>) => {
          jsxDepth--;
        },
      },
      Statement: (_path: NodePath<t.Statement>) => {
        nodeCount++;
      },
      Expression: (_path: NodePath<t.Expression>) => {
        nodeCount++;
      },
    });

    // Complexity factors:
    // - Node count: 0-0.3
    // - Hook count: 0-0.6 (higher weight since hooks add complexity)
    // - JSX depth: 0-0.3
    const nodeComplexity = Math.min(0.3, nodeCount / 500);
    const hookComplexity = Math.min(0.6, hookCount * 0.15); // Increased from 0.1 to 0.15
    const jsxComplexity = Math.min(0.3, maxJsxDepth * 0.05);

    return nodeComplexity + hookComplexity + jsxComplexity;
  }
}

/**
 * Create a FastCanMove instance.
 */
export function createFastCanMove(): FastCanMove {
  return new FastCanMove();
}
