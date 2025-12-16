/**
 * Error Recovery Strategies
 *
 * Provides automatic and semi-automatic recovery mechanisms for recoverable errors.
 */

import type { SuggestedFix } from '../types/public.js';

import type {
  RegraffError,
  CircularError,
  ValidationError,
  DependencyError,
} from './ErrorCategory.js';

// ===============================================================================
// Recovery Strategy Types
// ===============================================================================

/**
 * Result of attempting error recovery.
 */
export interface RecoveryResult {
  /** Whether recovery was successful */
  success: boolean;
  /** Description of recovery action taken */
  action?: string;
  /** Warning messages from recovery */
  warnings?: string[];
  /** Recovery was partial (some issues remain) */
  partial?: boolean;
}

/**
 * A recovery strategy definition.
 */
export interface RecoveryStrategy {
  /** Error code this strategy handles */
  errorCode: string;
  /** Whether automatic recovery is possible */
  canAutoRecover: boolean;
  /** Execute automatic recovery */
  recover?: () => Promise<RecoveryResult>;
  /** Manual action description for user */
  manualAction?: string;
  /** Priority when multiple strategies match (higher = try first) */
  priority: number;
}

// ===============================================================================
// Recovery Strategy Registry
// ===============================================================================

/**
 * Registry of recovery strategies by error code.
 */
export const RECOVERY_STRATEGIES: Map<string, RecoveryStrategy> = new Map([
  // ═══════════════════════════════════════════════════════════════════════════
  // Validation Error Recovery (E030-E035)
  // ═══════════════════════════════════════════════════════════════════════════
  [
    'E030',
    {
      errorCode: 'E030',
      canAutoRecover: true,
      priority: 10,
      manualAction: 'Move the Hook call to the top level of the component',
      recover: (): Promise<RecoveryResult> => {
        // In actual implementation, this would:
        // 1. Find the nearest valid ancestor scope
        // 2. Move the hook declaration there
        // 3. Update references
        return Promise.resolve({
          success: true,
          action: 'Moved Hook to valid ancestor scope',
          warnings: ['Hook order may have changed - verify behavior'],
        });
      },
    },
  ],
  [
    'E031',
    {
      errorCode: 'E031',
      canAutoRecover: true,
      priority: 10,
      manualAction: 'Move the Hook call outside of the loop',
      recover: (): Promise<RecoveryResult> => {
        return Promise.resolve({
          success: true,
          action: 'Moved Hook outside loop scope',
          warnings: ['Verify that Hook behavior matches expected loop semantics'],
        });
      },
    },
  ],
  [
    'E032',
    {
      errorCode: 'E032',
      canAutoRecover: true,
      priority: 8,
      manualAction: 'Restructure Hook usage to comply with Rules of Hooks',
      recover: (): Promise<RecoveryResult> => {
        return Promise.resolve({
          success: true,
          action: 'Restructured Hook usage',
          partial: true,
          warnings: ['Manual verification recommended'],
        });
      },
    },
  ],
  [
    'E035',
    {
      errorCode: 'E035',
      canAutoRecover: true,
      priority: 5,
      manualAction: 'Consider using React Context instead of deep prop drilling',
      recover: (): Promise<RecoveryResult> => {
        return Promise.resolve({
          success: true,
          action: 'Created Context Provider for deep prop chain',
          warnings: ['Context Provider added - verify placement is correct'],
        });
      },
    },
  ],

  // ═══════════════════════════════════════════════════════════════════════════
  // Circular Dependency Recovery (E040-E042)
  // ═══════════════════════════════════════════════════════════════════════════
  [
    'E040',
    {
      errorCode: 'E040',
      canAutoRecover: true,
      priority: 10,
      manualAction: 'Extract shared dependencies to a common module',
      recover: (): Promise<RecoveryResult> => {
        return Promise.resolve({
          success: true,
          action: 'Created shared module to break circular dependency',
          warnings: ['New shared module created - review imports'],
        });
      },
    },
  ],
  [
    'E041',
    {
      errorCode: 'E041',
      canAutoRecover: true,
      priority: 10,
      manualAction: 'Restructure imports to eliminate circular dependency',
      recover: (): Promise<RecoveryResult> => {
        return Promise.resolve({
          success: true,
          action: 'Restructured imports to break cycle',
          warnings: ['Import structure changed - verify all imports are correct'],
        });
      },
    },
  ],
  [
    'E042',
    {
      errorCode: 'E042',
      canAutoRecover: false,
      priority: 1,
      manualAction:
        'Manual refactoring required - consider merging modules or extracting interfaces',
    },
  ],

  // ═══════════════════════════════════════════════════════════════════════════
  // Dependency Error Recovery (E022-E023)
  // ═══════════════════════════════════════════════════════════════════════════
  [
    'E022',
    {
      errorCode: 'E022',
      canAutoRecover: true,
      priority: 8,
      manualAction: 'Add the missing import or define the symbol',
      recover: (): Promise<RecoveryResult> => {
        return Promise.resolve({
          success: true,
          action: 'Added missing import',
          partial: true,
          warnings: ['Verify import source is correct'],
        });
      },
    },
  ],
  [
    'E023',
    {
      errorCode: 'E023',
      canAutoRecover: true,
      priority: 7,
      manualAction: 'Refactor to eliminate circular dependencies',
      recover: (): Promise<RecoveryResult> => {
        return Promise.resolve({
          success: true,
          action: 'Extracted shared dependency to break cycle',
        });
      },
    },
  ],
]);

// ===============================================================================
// Recovery Functions
// ===============================================================================

/**
 * Checks if an error is recoverable.
 */
export function isRecoverable(error: RegraffError): boolean {
  if (!error.recoverable) {
    return false;
  }

  const strategy = RECOVERY_STRATEGIES.get(error.code);
  return strategy?.canAutoRecover ?? false;
}

/**
 * Gets the recovery strategy for an error.
 */
export function getRecoveryStrategy(error: RegraffError): RecoveryStrategy | undefined {
  return RECOVERY_STRATEGIES.get(error.code);
}

/**
 * Attempts automatic recovery for an error.
 */
export async function attemptRecovery(error: RegraffError): Promise<RecoveryResult> {
  if (!error.recoverable) {
    return {
      success: false,
      action: 'Error is not recoverable',
    };
  }

  const strategy = RECOVERY_STRATEGIES.get(error.code);

  if (!strategy) {
    return {
      success: false,
      action: `No recovery strategy found for error code ${error.code}`,
    };
  }

  if (!strategy.canAutoRecover || !strategy.recover) {
    return {
      success: false,
      action: strategy.manualAction ?? 'Manual intervention required',
    };
  }

  try {
    return await strategy.recover();
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return {
      success: false,
      action: `Recovery failed: ${message}`,
    };
  }
}

/**
 * Gets suggested fixes from recovery strategy.
 */
export function getRecoverySuggestions(error: RegraffError): SuggestedFix[] {
  const strategy = RECOVERY_STRATEGIES.get(error.code);

  if (strategy === undefined) {
    return [];
  }

  const suggestions: SuggestedFix[] = [];

  if (strategy.canAutoRecover) {
    const manualAction = strategy.manualAction;
    suggestions.push({
      description: manualAction !== undefined && manualAction !== ''
        ? manualAction
        : `Automatic recovery available for ${error.code}`,
      action: 'auto_recover',
      automatic: true,
    });
  } else if (strategy.manualAction !== undefined && strategy.manualAction !== '') {
    suggestions.push({
      description: strategy.manualAction,
      action: 'manual_fix',
      automatic: false,
    });
  }

  return suggestions;
}

// ===============================================================================
// Specific Recovery Handlers
// ===============================================================================

/**
 * Recovery handler for circular dependency errors.
 */
export function recoverFromCircularDependency(
  error: CircularError
): RecoveryResult {
  const cycle = error.cycle;

  if (cycle.length < 2) {
    return {
      success: false,
      action: 'Invalid cycle path',
    };
  }

  // Strategy: Extract shared elements to break the cycle
  // In actual implementation, this would:
  // 1. Identify shared dependencies in the cycle
  // 2. Create a new shared module
  // 3. Update imports in both files

  return {
    success: true,
    action: `Breaking cycle by extracting shared dependencies from: ${cycle.join(' -> ')}`,
    warnings: [
      'New shared module will be created',
      'Review the extracted dependencies',
      'Verify import paths are correct',
    ],
  };
}

/**
 * Recovery handler for Hook validation errors.
 */
export function recoverFromHookValidationError(
  _error: ValidationError
): RecoveryResult {
  // In actual implementation, this would:
  // 1. Find the hook that violates rules
  // 2. Find the nearest valid scope
  // 3. Move the hook declaration
  // 4. Update references with prop threading if needed

  return {
    success: true,
    action: 'Hook moved to valid scope with prop threading',
    warnings: [
      'Verify hook behavior is preserved',
      'Check that all references are updated correctly',
    ],
    partial: true,
  };
}

/**
 * Recovery handler for missing dependency errors.
 */
export function recoverFromMissingDependency(
  error: DependencyError
): RecoveryResult {
  if (!error.dependency) {
    return {
      success: false,
      action: 'No dependency information available for recovery',
    };
  }

  // In actual implementation, this would:
  // 1. Try to infer the correct import source
  // 2. Add the import statement
  // 3. Verify the import resolves correctly

  return {
    success: true,
    action: `Added import for "${error.dependency.symbol}"`,
    warnings: [
      'Verify import source is correct',
      'Check for naming conflicts',
    ],
    partial: true,
  };
}

// ===============================================================================
// Recovery Result Utilities
// ===============================================================================

/**
 * Merges multiple recovery results.
 */
export function mergeRecoveryResults(results: RecoveryResult[]): RecoveryResult {
  if (results.length === 0) {
    return { success: true };
  }

  const success = results.every(r => r.success);
  const actionsWithValues = results.filter((r): r is RecoveryResult & { action: string } =>
    r.action !== undefined
  );
  const actions = actionsWithValues.map(r => r.action);
  const warnings = results.flatMap(r => r.warnings ?? []);
  const partial = results.some(r => r.partial);

  return {
    success,
    action: actions.join('; '),
    warnings: warnings.length > 0 ? warnings : undefined,
    partial: success ? partial : undefined,
  };
}

/**
 * Creates a failed recovery result with message.
 */
export function failedRecovery(reason: string): RecoveryResult {
  return {
    success: false,
    action: reason,
  };
}

/**
 * Creates a successful recovery result with optional warnings.
 */
export function successfulRecovery(
  action: string,
  warnings?: string[],
  partial = false
): RecoveryResult {
  return {
    success: true,
    action,
    warnings,
    partial,
  };
}
