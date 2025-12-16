/**
 * Suggested Fixes Generation
 *
 * Provides contextual suggestions for error recovery and resolution.
 */

import type { SuggestedFix, Dependency } from '../types/public.js';
import { DependencyType } from '../types/public.js';

import type { RegraffError } from './error-category.js';
import { ErrorCategory } from './error-category.js';

// ===============================================================================
// Fix Types
// ===============================================================================

/**
 * Types of suggested fixes that can be applied.
 */
export type FixAction =
  | 'hoist_hook'
  | 'hoist_variable'
  | 'add_suspense'
  | 'extract_component'
  | 'add_import'
  | 'create_shared_module'
  | 'refactor_eval'
  | 'move_hook_to_top'
  | 'convert_to_prop'
  | 'wrap_with_provider'
  | 'break_cycle'
  | 'restructure_imports'
  | 'add_type_annotation'
  | 'fix_syntax';

/**
 * Creates a SuggestedFix object.
 */
export function createSuggestedFix(
  description: string,
  action: FixAction,
  automatic = false
): SuggestedFix {
  return { description, action, automatic };
}

// ===============================================================================
// Fix Generators by Error Category
// ===============================================================================

/**
 * Generates suggested fixes for parse errors.
 */
export function getSuggestedFixesForParseError(
  syntaxError: string,
  _file: string
): SuggestedFix[] {
  const fixes: SuggestedFix[] = [];

  // Common syntax error patterns
  if (syntaxError.includes('Unexpected token')) {
    fixes.push(
      createSuggestedFix(
        'Check for missing brackets, parentheses, or semicolons',
        'fix_syntax',
        false
      )
    );
  }

  if (syntaxError.includes('unterminated') || syntaxError.includes('Unterminated')) {
    fixes.push(
      createSuggestedFix(
        'Ensure all strings, template literals, and JSX elements are properly closed',
        'fix_syntax',
        false
      )
    );
  }

  if (syntaxError.includes('JSX')) {
    fixes.push(
      createSuggestedFix(
        'Verify JSX syntax: elements must have closing tags or be self-closing',
        'fix_syntax',
        false
      ),
      createSuggestedFix(
        'Check that JSX expressions are properly wrapped in curly braces',
        'fix_syntax',
        false
      )
    );
  }

  if (syntaxError.includes('TypeScript') || syntaxError.includes('type')) {
    fixes.push(
      createSuggestedFix(
        'Verify TypeScript type annotations are syntactically correct',
        'add_type_annotation',
        false
      )
    );
  }

  // Default suggestion
  if (fixes.length === 0) {
    fixes.push(
      createSuggestedFix(
        'Review the error location and check for syntax issues',
        'fix_syntax',
        false
      )
    );
  }

  return fixes;
}

/**
 * Generates suggested fixes for selector errors.
 */
export function getSuggestedFixesForSelectorError(
  errorCode: string,
  nearestMatch?: string
): SuggestedFix[] {
  const fixes: SuggestedFix[] = [];

  switch (errorCode) {
    case 'E010': // No JSX element at position
      fixes.push(
        createSuggestedFix(
          'Ensure the cursor/position is within a JSX element',
          'fix_syntax',
          false
        )
      );
      if (nearestMatch !== undefined && nearestMatch !== '') {
        fixes.push(
          createSuggestedFix(
            `Nearest JSX element found: ${nearestMatch}`,
            'fix_syntax',
            false
          )
        );
      }
      break;

    case 'E011': // Invalid AST path
      fixes.push(
        createSuggestedFix(
          'Use a position selector (line/column) instead of AST path',
          'fix_syntax',
          false
        ),
        createSuggestedFix(
          'Verify the AST path matches the current file structure',
          'fix_syntax',
          false
        )
      );
      break;

    case 'E012': // File not in input
      fixes.push(
        createSuggestedFix(
          'Add the referenced file to the files array',
          'fix_syntax',
          false
        )
      );
      break;

    case 'E013': // Element not movable
      fixes.push(
        createSuggestedFix(
          'Consider extracting the element to a separate component first',
          'extract_component',
          false
        )
      );
      break;

    case 'E014': // Same source and target
      fixes.push(
        createSuggestedFix(
          'Specify a different target location for the move',
          'fix_syntax',
          false
        )
      );
      break;

    case 'E015': // Move into self
      fixes.push(
        createSuggestedFix(
          'Choose a target that is not a descendant of the source element',
          'fix_syntax',
          false
        )
      );
      break;
  }

  return fixes;
}

/**
 * Generates suggested fixes for dependency errors.
 */
export function getSuggestedFixesForDependencyError(
  errorCode: string,
  dependency?: Dependency
): SuggestedFix[] {
  const fixes: SuggestedFix[] = [];

  switch (errorCode) {
    case 'E020': // eval() detected
      fixes.push(
        createSuggestedFix(
          'Refactor code to remove eval() usage',
          'refactor_eval',
          false
        ),
        createSuggestedFix(
          'Consider using JSON.parse() for parsing JSON strings',
          'refactor_eval',
          false
        ),
        createSuggestedFix(
          'Use a safer alternative like Function constructor with known input',
          'refactor_eval',
          false
        )
      );
      break;

    case 'E021': // Dynamic code execution
      fixes.push(
        createSuggestedFix(
          'Refactor dynamic code to static patterns',
          'refactor_eval',
          false
        ),
        createSuggestedFix(
          'Use a mapping object instead of dynamic property access',
          'refactor_eval',
          false
        )
      );
      break;

    case 'E022': // Unresolvable external reference
      if (dependency) {
        fixes.push(
          createSuggestedFix(
            `Add an import for "${dependency.symbol}"`,
            'add_import',
            true
          )
        );
      }
      fixes.push(
        createSuggestedFix(
          'Ensure the symbol is defined or imported in the current scope',
          'add_import',
          false
        )
      );
      break;

    case 'E023': // Dependency cycle
      fixes.push(
        createSuggestedFix(
          'Refactor to break the dependency cycle',
          'break_cycle',
          true
        ),
        createSuggestedFix(
          'Extract shared dependencies to a separate module',
          'create_shared_module',
          true
        )
      );
      break;

    case 'E024': // Cannot determine scope
      fixes.push(
        createSuggestedFix(
          'Ensure the symbol is defined in a clear lexical scope',
          'fix_syntax',
          false
        )
      );
      break;
  }

  return fixes;
}

/**
 * Generates suggested fixes for validation errors.
 */
export function getSuggestedFixesForValidationError(
  errorCode: string,
  hookName?: string
): SuggestedFix[] {
  const fixes: SuggestedFix[] = [];

  switch (errorCode) {
    case 'E030': // Hook in conditional
      fixes.push(
        createSuggestedFix(
          `Move ${hookName ?? 'the hook'} outside of the conditional block`,
          'move_hook_to_top',
          true
        ),
        createSuggestedFix(
          'Consider using a custom hook to encapsulate the conditional logic',
          'extract_component',
          false
        )
      );
      break;

    case 'E031': // Hook in loop
      fixes.push(
        createSuggestedFix(
          `Move ${hookName ?? 'the hook'} outside of the loop`,
          'move_hook_to_top',
          true
        ),
        createSuggestedFix(
          'Extract the loop iteration into a separate component',
          'extract_component',
          false
        )
      );
      break;

    case 'E032': // Hook rules violation
      fixes.push(
        createSuggestedFix(
          'Ensure hooks are called at the top level of a React component',
          'move_hook_to_top',
          true
        ),
        createSuggestedFix(
          'Extract the affected code into a custom hook',
          'extract_component',
          false
        )
      );
      break;

    case 'E033': // Hook outside component
      fixes.push(
        createSuggestedFix(
          'Move the hook call inside a React component or custom hook',
          'move_hook_to_top',
          false
        )
      );
      break;

    case 'E034': // Invalid target scope
      fixes.push(
        createSuggestedFix(
          'Choose a different target location that can accept the dependency',
          'fix_syntax',
          false
        ),
        createSuggestedFix(
          'Convert the dependency to a prop that can be passed down',
          'convert_to_prop',
          true
        )
      );
      break;

    case 'E035': // Props threading depth exceeded
      fixes.push(
        createSuggestedFix(
          'Use React Context to share the value without deep prop drilling',
          'wrap_with_provider',
          true
        ),
        createSuggestedFix(
          'Consider using a state management library',
          'fix_syntax',
          false
        )
      );
      break;
  }

  return fixes;
}

/**
 * Generates suggested fixes for circular errors.
 */
export function getSuggestedFixesForCircularError(
  errorCode: string,
  cycle: string[]
): SuggestedFix[] {
  const fixes: SuggestedFix[] = [];

  switch (errorCode) {
    case 'E040': // Circular dependency
      fixes.push(
        createSuggestedFix(
          'Extract shared dependencies to a common module',
          'create_shared_module',
          true
        ),
        createSuggestedFix(
          `Circular path: ${cycle.join(' -> ')}`,
          'break_cycle',
          false
        )
      );
      break;

    case 'E041': // Cross-file circular import
      fixes.push(
        createSuggestedFix(
          'Create a shared module for common dependencies',
          'create_shared_module',
          true
        ),
        createSuggestedFix(
          'Restructure imports to break the cycle',
          'restructure_imports',
          true
        ),
        createSuggestedFix(
          'Use lazy imports (dynamic import) to break the cycle',
          'fix_syntax',
          false
        )
      );
      break;

    case 'E042': // Cannot break cycle
      fixes.push(
        createSuggestedFix(
          'Manual refactoring required to resolve the circular dependency',
          'fix_syntax',
          false
        ),
        createSuggestedFix(
          'Consider merging the cyclically dependent modules',
          'fix_syntax',
          false
        )
      );
      break;
  }

  return fixes;
}

/**
 * Generates suggested fixes for transform errors.
 */
export function getSuggestedFixesForTransformError(
  errorCode: string,
  reason: string
): SuggestedFix[] {
  const fixes: SuggestedFix[] = [];

  switch (errorCode) {
    case 'E050': // Failed to insert
    case 'E051': // Failed to update references
    case 'E052': // Failed to remove source
      fixes.push(
        createSuggestedFix(
          'Try with a simpler move operation first',
          'fix_syntax',
          false
        ),
        createSuggestedFix(
          `Error details: ${reason}`,
          'fix_syntax',
          false
        )
      );
      break;

    case 'E053': // Hoisting failed
      fixes.push(
        createSuggestedFix(
          'Try converting the dependency to a prop instead of hoisting',
          'convert_to_prop',
          true
        )
      );
      break;

    case 'E054': // Import update failed
      fixes.push(
        createSuggestedFix(
          'Manually add the required imports',
          'add_import',
          false
        )
      );
      break;
  }

  return fixes;
}

// ===============================================================================
// Dependency-Based Suggestions
// ===============================================================================

/**
 * Generates suggested fixes based on dependency type.
 */
export function getSuggestedFixesForDependency(
  dependency: Dependency,
  targetAccessible: boolean
): SuggestedFix[] {
  if (targetAccessible) {
    return [];
  }

  const fixes: SuggestedFix[] = [];
  const depType: DependencyType = dependency.type;

  switch (depType) {
    case DependencyType.Hook:
      fixes.push(
        createSuggestedFix(
          `Hoist "${dependency.symbol}" to common ancestor component`,
          'hoist_hook',
          true
        ),
        createSuggestedFix(
          `Convert "${dependency.symbol}" result to a prop`,
          'convert_to_prop',
          true
        )
      );
      break;

    case DependencyType.Variable:
      fixes.push(
        createSuggestedFix(
          `Hoist "${dependency.symbol}" to common ancestor scope`,
          'hoist_variable',
          true
        ),
        createSuggestedFix(
          `Pass "${dependency.symbol}" as a prop`,
          'convert_to_prop',
          true
        )
      );
      break;

    case DependencyType.Import:
      fixes.push(
        createSuggestedFix(
          `Add import for "${dependency.symbol}" in target file`,
          'add_import',
          true
        )
      );
      break;

    case DependencyType.Prop:
      fixes.push(
        createSuggestedFix(
          `Thread "${dependency.symbol}" prop through component tree`,
          'convert_to_prop',
          true
        ),
        createSuggestedFix(
          `Use Context to provide "${dependency.symbol}"`,
          'wrap_with_provider',
          true
        )
      );
      break;

    case DependencyType.Context:
      fixes.push(
        createSuggestedFix(
          'Move Context.Provider to common ancestor',
          'wrap_with_provider',
          true
        ),
        createSuggestedFix(
          'Extract context value to prop',
          'convert_to_prop',
          true
        )
      );
      break;

    case DependencyType.Ref:
      fixes.push(
        createSuggestedFix(
          `Hoist "${dependency.symbol}" ref to common ancestor`,
          'hoist_hook',
          true
        ),
        createSuggestedFix(
          'Use forwardRef to pass ref down',
          'convert_to_prop',
          true
        )
      );
      break;
  }

  return fixes;
}

// ===============================================================================
// Unified Suggestion Generator
// ===============================================================================

/**
 * Gets all suggested fixes for a given error.
 */
export function getSuggestedFixesForError(error: RegraffError): SuggestedFix[] {
  // If error already has suggestions, return them
  if (error.suggestions.length > 0) {
    return error.suggestions;
  }

  switch (error.category) {
    case ErrorCategory.Parse:
      return getSuggestedFixesForParseError(error.message, error.file ?? '');

    case ErrorCategory.Selector:
      return getSuggestedFixesForSelectorError(error.code);

    case ErrorCategory.Dependency:
      return getSuggestedFixesForDependencyError(error.code);

    case ErrorCategory.Validation:
      return getSuggestedFixesForValidationError(error.code);

    case ErrorCategory.Circular:
      return getSuggestedFixesForCircularError(error.code, []);

    case ErrorCategory.Transform:
      return getSuggestedFixesForTransformError(error.code, error.message);

    default:
      return [];
  }
}
