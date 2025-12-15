/**
 * Move Validator
 *
 * Validates whether a proposed move operation is valid and safe.
 * Implements the canMove API and provides detailed validation reporting.
 */

import type { NodePath } from '@babel/traverse';
import traverseModule from '@babel/traverse';
import type * as t from '@babel/types';

// Handle both ESM and CJS exports
const traverse: typeof traverseModule =
  (traverseModule as any).default || traverseModule;

import { Parser, createParser } from '../parser/index.js';
import { createAtomicUnit, createResolveResult, createSelectorError } from '../types/factories.js';
import { AtomicUnitType } from '../types/internal.js';
import type { AtomicUnit, ResolveResult, AnalyzabilityResult, UnanalyzableCode } from '../types/internal.js';
import type { FileInput, Selector, Move } from '../types/public.js';
import { isPositionSelector, isPathSelector } from '../types/public.js';

import {
  detectAtomicUnit,
  detectConditionalExpression,
  detectTernaryExpression,
  detectMapExpression,
  detectCompoundComponent,
  isJSXNode,
} from './atomic-unit-detector.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Result of move validation
 */
export interface MoveValidationResult {
  /** Whether the move is valid */
  valid: boolean;
  /** Human-readable reason if invalid */
  reason?: string;
  /** Error code for programmatic handling */
  errorCode?: MoveValidationError;
  /** Warnings that don't prevent the move but should be noted */
  warnings: string[];
  /** The resolved source element */
  source?: ResolveResult;
  /** The resolved target element */
  target?: ResolveResult;
  /** Analyzability information */
  analyzability?: AnalyzabilityResult;
}

/**
 * Validation rule function type
 */
export type ValidationRule = (
  source: ResolveResult,
  target: ResolveResult,
  mode: Move,
  context: ValidationContext
) => ValidationRuleResult;

/**
 * Result from a single validation rule
 */
interface ValidationRuleResult {
  valid: boolean;
  reason?: string;
  errorCode?: MoveValidationError;
  warning?: string;
}

/**
 * Context passed to validation rules
 */
interface ValidationContext {
  files: Map<string, t.File>;
  parser: Parser;
  sourceFile: string;
  targetFile: string;
}

/**
 * Error codes for move validation failures
 */
export enum MoveValidationError {
  /** Source selector could not be resolved */
  SOURCE_NOT_FOUND = 'SOURCE_NOT_FOUND',
  /** Target selector could not be resolved */
  TARGET_NOT_FOUND = 'TARGET_NOT_FOUND',
  /** Source file not found in inputs */
  SOURCE_FILE_NOT_FOUND = 'SOURCE_FILE_NOT_FOUND',
  /** Target file not found in inputs */
  TARGET_FILE_NOT_FOUND = 'TARGET_FILE_NOT_FOUND',
  /** Cannot move element to itself */
  SELF_MOVE = 'SELF_MOVE',
  /** Target is a descendant of source */
  TARGET_IS_DESCENDANT = 'TARGET_IS_DESCENDANT',
  /** Source is a descendant of target (for Inside mode) */
  SOURCE_IS_DESCENDANT = 'SOURCE_IS_DESCENDANT',
  /** Move would break hook rules */
  HOOK_RULES_VIOLATION = 'HOOK_RULES_VIOLATION',
  /** Move would break conditional rendering rules */
  CONDITIONAL_RENDERING_VIOLATION = 'CONDITIONAL_RENDERING_VIOLATION',
  /** Code contains unanalyzable constructs */
  UNANALYZABLE_CODE = 'UNANALYZABLE_CODE',
  /** Target does not support children (for Inside mode) */
  TARGET_NO_CHILDREN = 'TARGET_NO_CHILDREN',
  /** Invalid atomic unit move */
  INVALID_ATOMIC_UNIT = 'INVALID_ATOMIC_UNIT',
  /** Cannot move outside component boundary */
  COMPONENT_BOUNDARY_VIOLATION = 'COMPONENT_BOUNDARY_VIOLATION',
  /** Parse error in source or target file */
  PARSE_ERROR = 'PARSE_ERROR',
  /** Invalid selector format */
  INVALID_SELECTOR = 'INVALID_SELECTOR',
}

// ============================================================================
// Selector Resolution
// ============================================================================

/**
 * Resolve a selector to a NodePath in the AST
 */
function resolveSelector(
  selector: Selector,
  ast: t.File,
  _filename: string
): ResolveResult {
  if (isPositionSelector(selector)) {
    return resolvePositionSelector(selector, ast);
  } else if (isPathSelector(selector)) {
    return resolvePathSelector(selector, ast);
  }

  return createResolveResult({
    node: null,
    path: null,
    atomicUnit: null,
    error: createSelectorError({
      message: 'Invalid selector format',
      code: MoveValidationError.INVALID_SELECTOR,
    }),
  });
}

/**
 * Resolve a position-based selector (line/column)
 */
function resolvePositionSelector(
  selector: { line: number; column: number },
  ast: t.File
): ResolveResult {
  let foundPath: NodePath | null = null;
  let foundNode: t.Node | null = null;

  traverse(ast, {
    enter(path) {
      const loc = path.node.loc;
      if (!loc) return;

      // Check if selector position is within this node's range
      const startLine = loc.start.line;
      const startCol = loc.start.column + 1; // Convert to 1-based
      const endLine = loc.end.line;
      const endCol = loc.end.column + 1;

      // Check if position is within bounds
      const afterStart =
        selector.line > startLine ||
        (selector.line === startLine && selector.column >= startCol);
      const beforeEnd =
        selector.line < endLine ||
        (selector.line === endLine && selector.column <= endCol);

      if (afterStart && beforeEnd) {
        // Prefer the most specific (deepest) node
        if (!foundPath || isMoreSpecific(path, foundPath)) {
          foundPath = path;
          foundNode = path.node;
        }
      }
    },
  });

  if (!foundPath || !foundNode) {
    return createResolveResult({
      node: null,
      path: null,
      atomicUnit: null,
      error: createSelectorError({
        message: `No element found at position ${selector.line}:${selector.column}`,
        code: MoveValidationError.SOURCE_NOT_FOUND,
        location: {
          start: { line: selector.line, column: selector.column },
          end: { line: selector.line, column: selector.column },
        },
      }),
    });
  }

  // Detect atomic unit
  const atomicUnit = detectAtomicUnit(foundPath);

  return createResolveResult({
    node: foundNode,
    path: foundPath,
    atomicUnit,
  });
}

/**
 * Resolve a path-based selector (AST path)
 */
function resolvePathSelector(
  selector: { path: string },
  ast: t.File
): ResolveResult {
  try {
    const pathParts = parseASTPath(selector.path);
    let current: unknown = ast;
    let currentPath: NodePath | null = null;

    // Use traverse to get the NodePath for the root
    traverse(ast, {
      Program(path) {
        currentPath = path;
      },
    });

    for (const part of pathParts) {
      if (current === null || current === undefined) {
        return createResolveResult({
          node: null,
          path: null,
          atomicUnit: null,
          error: createSelectorError({
            message: `Path segment '${part.key}' not found`,
            code: MoveValidationError.SOURCE_NOT_FOUND,
          }),
        });
      }

      const obj = current as Record<string, unknown>;

      if (part.index !== undefined) {
        // Array access
        const arr = obj[part.key];
        if (!Array.isArray(arr)) {
          return createResolveResult({
            node: null,
            path: null,
            atomicUnit: null,
            error: createSelectorError({
              message: `'${part.key}' is not an array`,
              code: MoveValidationError.SOURCE_NOT_FOUND,
            }),
          });
        }
        current = arr[part.index];
      } else {
        // Property access
        current = obj[part.key];
      }
    }

    if (!current || typeof current !== 'object' || !('type' in current)) {
      return createResolveResult({
        node: null,
        path: null,
        atomicUnit: null,
        error: createSelectorError({
          message: 'Path does not resolve to an AST node',
          code: MoveValidationError.SOURCE_NOT_FOUND,
        }),
      });
    }

    const node = current as t.Node;

    // Find the NodePath for this node
    let foundPath: NodePath | null = null;
    traverse(ast, {
      enter(path) {
        if (path.node === node) {
          foundPath = path;
          path.stop();
        }
      },
    });

    if (!foundPath) {
      foundPath = currentPath;
    }

    // Detect atomic unit
    const atomicUnit = foundPath ? detectAtomicUnit(foundPath) : null;

    return createResolveResult({
      node,
      path: foundPath,
      atomicUnit,
    });
  } catch (error) {
    return createResolveResult({
      node: null,
      path: null,
      atomicUnit: null,
      error: createSelectorError({
        message: `Failed to resolve path: ${error instanceof Error ? error.message : 'Unknown error'}`,
        code: MoveValidationError.SOURCE_NOT_FOUND,
      }),
    });
  }
}

/**
 * Parse an AST path string into parts
 */
function parseASTPath(path: string): Array<{ key: string; index?: number }> {
  const parts: Array<{ key: string; index?: number }> = [];
  const regex = /(\w+)(?:\[(\d+)\])?/g;
  let match;

  while ((match = regex.exec(path)) !== null) {
    parts.push({
      key: match[1],
      index: match[2] !== undefined ? parseInt(match[2], 10) : undefined,
    });
  }

  return parts;
}

/**
 * Check if path1 is more specific (deeper) than path2
 */
function isMoreSpecific(path1: NodePath, path2: NodePath): boolean {
  // A JSX element is more specific than a non-JSX element at the same level
  if (isJSXNode(path1.node) && !isJSXNode(path2.node)) {
    return true;
  }

  // Count depth by walking up to root
  let depth1 = 0;
  let depth2 = 0;

  let current: NodePath | null = path1;
  while (current) {
    depth1++;
    current = current.parentPath;
  }

  current = path2;
  while (current) {
    depth2++;
    current = current.parentPath;
  }

  return depth1 > depth2;
}

/**
 * Normalize a resolved result to its nearest JSXElement ancestor.
 * This ensures validation rules work with consistent node types.
 */
function normalizeToJSXElement(result: ResolveResult): ResolveResult {
  if (!result.path || !result.node) {
    return result;
  }

  // If already a JSXElement, return as-is
  if (result.node.type === 'JSXElement') {
    return result;
  }

  // Walk up to find nearest JSXElement
  let current: NodePath | null = result.path;
  while (current) {
    if (current.node.type === 'JSXElement') {
      // Update the result to point to the JSXElement
      return createResolveResult({
        node: current.node,
        path: current,
        atomicUnit: result.atomicUnit, // Keep the original atomic unit
        error: result.error,
      });
    }
    current = current.parentPath;
  }

  // No JSXElement ancestor found, return original
  return result;
}

// ============================================================================
// Analyzability Check
// ============================================================================

/**
 * Check if the code is analyzable (no eval, dynamic code, etc.)
 */
function checkAnalyzability(ast: t.File): AnalyzabilityResult {
  const blockers: UnanalyzableCode[] = [];

  traverse(ast, {
    // Check for eval()
    CallExpression(path) {
      const callee = path.node.callee;
      if (callee.type === 'Identifier' && callee.name === 'eval') {
        blockers.push({
          type: 'eval',
          location: path.node.loc
            ? {
                start: { line: path.node.loc.start.line, column: path.node.loc.start.column },
                end: { line: path.node.loc.end.line, column: path.node.loc.end.column },
              }
            : { start: { line: 0, column: 0 }, end: { line: 0, column: 0 } },
          description: 'eval() makes static analysis impossible',
        });
      }

      // Check for Function constructor (as a call)
      if (
        callee.type === 'Identifier' &&
        callee.name === 'Function' &&
        path.node.arguments.length > 0
      ) {
        blockers.push({
          type: 'dynamicCode',
          location: path.node.loc
            ? {
                start: { line: path.node.loc.start.line, column: path.node.loc.start.column },
                end: { line: path.node.loc.end.line, column: path.node.loc.end.column },
              }
            : { start: { line: 0, column: 0 }, end: { line: 0, column: 0 } },
          description: 'Function constructor creates dynamic code',
        });
      }
    },

    // Check for new Function() constructor
    NewExpression(path) {
      const callee = path.node.callee;
      if (
        callee.type === 'Identifier' &&
        callee.name === 'Function' &&
        path.node.arguments.length > 0
      ) {
        blockers.push({
          type: 'dynamicCode',
          location: path.node.loc
            ? {
                start: { line: path.node.loc.start.line, column: path.node.loc.start.column },
                end: { line: path.node.loc.end.line, column: path.node.loc.end.column },
              }
            : { start: { line: 0, column: 0 }, end: { line: 0, column: 0 } },
          description: 'Function constructor creates dynamic code',
        });
      }
    },

    // Check for with statements
    WithStatement(path) {
      blockers.push({
        type: 'dynamicCode',
        location: path.node.loc
          ? {
              start: { line: path.node.loc.start.line, column: path.node.loc.start.column },
              end: { line: path.node.loc.end.line, column: path.node.loc.end.column },
            }
          : { start: { line: 0, column: 0 }, end: { line: 0, column: 0 } },
        description: 'with statement makes scope analysis impossible',
      });
    },
  });

  return {
    analyzable: blockers.length === 0,
    blockers: blockers.length > 0 ? blockers : undefined,
  };
}

// ============================================================================
// Validation Rules
// ============================================================================

/**
 * Rule: Moving element to itself is allowed (will be handled as no-op)
 * Task 1.4.3: Source-target identity detection should return success
 */
const selfMoveRule: ValidationRule = (source, target, _mode, _context) => {
  if (source.node === target.node) {
    // Allow self-moves as no-ops
    return {
      valid: true,
      warning: 'Moving element to itself (will be no-op)',
    };
  }
  return { valid: true };
};

/**
 * Rule: Target cannot be a descendant of source
 */
const targetNotDescendantRule: ValidationRule = (source, target, _mode, _context) => {
  if (!source.path || !target.path) {
    return { valid: true };
  }

  // Skip check if source and target are the same (will be handled as no-op)
  if (source.node === target.node) {
    return { valid: true };
  }

  // Check if target is a descendant of source
  let current: NodePath | null = target.path;
  while (current) {
    if (current.node === source.node) {
      return {
        valid: false,
        reason: 'Cannot move element into its own descendant',
        errorCode: MoveValidationError.TARGET_IS_DESCENDANT,
      };
    }
    current = current.parentPath;
  }

  return { valid: true };
};

/**
 * Rule: Source cannot already be a descendant of target (for Inside mode)
 */
const sourceNotDescendantRule: ValidationRule = (source, target, mode, _context) => {
  if (mode !== 'inside') {
    return { valid: true };
  }

  if (!source.path || !target.path) {
    return { valid: true };
  }

  // Skip check if source and target are the same (will be handled as no-op)
  if (source.node === target.node) {
    return { valid: true };
  }

  // Check if source is a descendant of target
  let current: NodePath | null = source.path;
  while (current) {
    if (current.node === target.node) {
      return {
        valid: false,
        reason: 'Source is already a descendant of target',
        errorCode: MoveValidationError.SOURCE_IS_DESCENDANT,
      };
    }
    current = current.parentPath;
  }

  return { valid: true };
};

/**
 * Rule: Target must support children for Inside mode
 */
const targetSupportsChildrenRule: ValidationRule = (_source, target, mode, _context) => {
  if (mode !== 'inside') {
    return { valid: true };
  }

  if (!target.node || !target.path) {
    return { valid: true };
  }

  // Target should already be normalized to JSXElement by validateMove
  if (target.node.type !== 'JSXElement') {
    return { valid: true };
  }

  // Check for self-closing elements that don't support children
  const element = target.node;
  const openingElement = element.openingElement;

  // Get element name
  let elementName = '';
  if (openingElement.name.type === 'JSXIdentifier') {
    elementName = openingElement.name.name;
  }

  // Known void elements that don't support children
  const voidElements = [
    'input', 'img', 'br', 'hr', 'meta', 'link',
    'area', 'base', 'col', 'embed', 'param', 'source', 'track', 'wbr',
  ];

  if (voidElements.includes(elementName.toLowerCase())) {
    return {
      valid: false,
      reason: `<${elementName}> is a void element and cannot have children`,
      errorCode: MoveValidationError.TARGET_NO_CHILDREN,
    };
  }

  // Also check if the element is self-closing (has no children and is self-closed)
  if (openingElement.selfClosing && element.children.length === 0) {
    // This is a self-closing element, check if it's a known void element or custom component
    // For lowercase (HTML) elements that are self-closing, they shouldn't accept children
    if (elementName && elementName[0] === elementName[0]?.toLowerCase()) {
      return {
        valid: false,
        reason: `<${elementName} /> is self-closing and cannot have children`,
        errorCode: MoveValidationError.TARGET_NO_CHILDREN,
      };
    }
  }

  return { valid: true };
};

/**
 * Rule: Validate hook rules (hooks cannot be called conditionally)
 */
const hookRulesRule: ValidationRule = (source, target, _mode, _context) => {
  if (!source.path || !target.path) {
    return { valid: true };
  }

  // Check if source contains hooks
  let hasHooks = false;
  const sourceNode = source.node;

  if (sourceNode) {
    traverse(
      { type: 'File', program: { type: 'Program', body: [], sourceType: 'module', directives: [] } } as t.File,
      {
        CallExpression(path) {
          const callee = path.node.callee;
          if (callee.type === 'Identifier' && callee.name.startsWith('use')) {
            hasHooks = true;
            path.stop();
          }
        },
      },
      undefined,
      { sourceNode }
    );
  }

  if (!hasHooks) {
    return { valid: true };
  }

  // Check if target is inside a conditional context
  let current: NodePath | null = target.path;
  while (current) {
    const node = current.node;

    // Check for conditional contexts
    if (
      node.type === 'IfStatement' ||
      node.type === 'ConditionalExpression' ||
      node.type === 'LogicalExpression'
    ) {
      return {
        valid: false,
        reason: 'Moving this element would place hooks inside a conditional context, violating React hook rules',
        errorCode: MoveValidationError.HOOK_RULES_VIOLATION,
      };
    }

    // Check for loop contexts
    if (
      node.type === 'ForStatement' ||
      node.type === 'ForInStatement' ||
      node.type === 'ForOfStatement' ||
      node.type === 'WhileStatement' ||
      node.type === 'DoWhileStatement'
    ) {
      return {
        valid: false,
        reason: 'Moving this element would place hooks inside a loop, violating React hook rules',
        errorCode: MoveValidationError.HOOK_RULES_VIOLATION,
      };
    }

    current = current.parentPath;
  }

  return { valid: true };
};

/**
 * Rule: Validate atomic unit integrity
 */
const atomicUnitRule: ValidationRule = (source, _target, _mode, _context) => {
  if (!source.atomicUnit) {
    return { valid: true };
  }

  const atomicUnit = source.atomicUnit;

  // Compound components should ideally be moved with their parent
  if (atomicUnit.type === AtomicUnitType.CompoundComponent) {
    return {
      valid: true,
      warning: 'Moving a compound component sub-element. Consider moving the entire compound component group.',
    };
  }

  // Map expressions contain closures that might reference outer scope
  if (atomicUnit.type === AtomicUnitType.MapExpression) {
    return {
      valid: true,
      warning: 'Moving a map expression. Ensure iterator variables remain in scope.',
    };
  }

  return { valid: true };
};

/**
 * All validation rules to apply
 */
const validationRules: ValidationRule[] = [
  selfMoveRule,
  targetNotDescendantRule,
  sourceNotDescendantRule,
  targetSupportsChildrenRule,
  hookRulesRule,
  atomicUnitRule,
];

// ============================================================================
// Main Validation Function
// ============================================================================

/**
 * Validate a proposed move operation
 *
 * @param files - Array of file inputs with path and content
 * @param from - Selector identifying the source element
 * @param to - Selector identifying the target location
 * @param mode - How to position the element relative to target
 * @returns Validation result with detailed information
 */
export function validateMove(
  files: FileInput[],
  from: Selector,
  to: Selector,
  mode: Move
): MoveValidationResult {
  const warnings: string[] = [];
  const parser = createParser();

  // Build file map
  const fileMap = new Map<string, string>();
  for (const file of files) {
    fileMap.set(file.path, file.content);
  }

  // Get source and target files
  const sourceFile = from.file;
  const targetFile = to.file;

  // Check source file exists
  const sourceContent = fileMap.get(sourceFile);
  if (!sourceContent) {
    return {
      valid: false,
      reason: `Source file not found: ${sourceFile}`,
      errorCode: MoveValidationError.SOURCE_FILE_NOT_FOUND,
      warnings,
    };
  }

  // Check target file exists
  const targetContent = fileMap.get(targetFile);
  if (!targetContent) {
    return {
      valid: false,
      reason: `Target file not found: ${targetFile}`,
      errorCode: MoveValidationError.TARGET_FILE_NOT_FOUND,
      warnings,
    };
  }

  // Parse source file
  const sourceParseResult = parser.parse(sourceContent, sourceFile);
  if (!sourceParseResult.success || !sourceParseResult.ast) {
    return {
      valid: false,
      reason: `Failed to parse source file: ${sourceParseResult.errors.map(e => e.message).join(', ')}`,
      errorCode: MoveValidationError.PARSE_ERROR,
      warnings,
    };
  }

  // Parse target file (may be same as source)
  let targetParseResult = sourceParseResult;
  if (targetFile !== sourceFile) {
    targetParseResult = parser.parse(targetContent, targetFile);
    if (!targetParseResult.success || !targetParseResult.ast) {
      return {
        valid: false,
        reason: `Failed to parse target file: ${targetParseResult.errors.map(e => e.message).join(', ')}`,
        errorCode: MoveValidationError.PARSE_ERROR,
        warnings,
      };
    }
  }

  // Check analyzability
  const sourceAnalyzability = checkAnalyzability(sourceParseResult.ast);
  if (!sourceAnalyzability.analyzable) {
    return {
      valid: false,
      reason: `Source file contains unanalyzable code: ${sourceAnalyzability.blockers?.[0]?.description}`,
      errorCode: MoveValidationError.UNANALYZABLE_CODE,
      warnings,
      analyzability: sourceAnalyzability,
    };
  }

  if (targetFile !== sourceFile && targetParseResult.ast) {
    const targetAnalyzability = checkAnalyzability(targetParseResult.ast);
    if (!targetAnalyzability.analyzable) {
      return {
        valid: false,
        reason: `Target file contains unanalyzable code: ${targetAnalyzability.blockers?.[0]?.description}`,
        errorCode: MoveValidationError.UNANALYZABLE_CODE,
        warnings,
        analyzability: targetAnalyzability,
      };
    }
  }

  // Resolve source selector
  let source = resolveSelector(from, sourceParseResult.ast, sourceFile);
  if (source.error || !source.node) {
    return {
      valid: false,
      reason: source.error?.message || 'Source element not found',
      errorCode: MoveValidationError.SOURCE_NOT_FOUND,
      warnings,
      source,
    };
  }

  // Normalize to JSXElement for consistent validation
  source = normalizeToJSXElement(source);

  // Resolve target selector
  let target = resolveSelector(to, targetParseResult.ast!, targetFile);
  if (target.error || !target.node) {
    return {
      valid: false,
      reason: target.error?.message || 'Target element not found',
      errorCode: MoveValidationError.TARGET_NOT_FOUND,
      warnings,
      source,
      target,
    };
  }

  // Normalize to JSXElement for consistent validation
  target = normalizeToJSXElement(target);

  // Build AST map
  const astMap = new Map<string, t.File>();
  astMap.set(sourceFile, sourceParseResult.ast);
  if (targetFile !== sourceFile && targetParseResult.ast) {
    astMap.set(targetFile, targetParseResult.ast);
  }

  // Build validation context
  const context: ValidationContext = {
    files: astMap,
    parser,
    sourceFile,
    targetFile,
  };

  // Run all validation rules
  for (const rule of validationRules) {
    const result = rule(source, target, mode, context);

    if (!result.valid) {
      return {
        valid: false,
        reason: result.reason,
        errorCode: result.errorCode,
        warnings,
        source,
        target,
        analyzability: sourceAnalyzability,
      };
    }

    if (result.warning) {
      warnings.push(result.warning);
    }
  }

  return {
    valid: true,
    warnings,
    source,
    target,
    analyzability: sourceAnalyzability,
  };
}

/**
 * Check if an element can be moved (simplified boolean API)
 *
 * @param files - Array of file inputs with path and content
 * @param from - Selector identifying the source element
 * @param to - Selector identifying the target location
 * @param mode - How to position the element relative to target
 * @returns true if the move is valid, false otherwise
 */
export function canMoveElement(
  files: FileInput[],
  from: Selector,
  to: Selector,
  mode: Move
): boolean {
  const result = validateMove(files, from, to, mode);
  return result.valid;
}
