/**
 * Runtime Type Validation
 *
 * Provides runtime validation for API inputs with helpful error messages.
 */

import { RegraffError, ErrorCategory } from '../errors/ErrorCategory.js';
import type {
  Selector,
  PositionSelector,
  PathSelector,
  Options,
  FileInput,
  Move,
} from '../types/public.js';
import {
  isValidMove,
} from '../types/public.js';

// ===============================================================================
// Validation Error Class
// ===============================================================================

/**
 * Error thrown when input validation fails.
 */
export class InputValidationError extends RegraffError {
  /** The parameter name that failed validation */
  readonly parameterName: string;
  /** The expected type/format */
  readonly expected: string;
  /** The actual value received */
  readonly actual: unknown;

  constructor(params: {
    parameterName: string;
    expected: string;
    actual: unknown;
    message?: string;
  }) {
    const message =
      params.message ??
      `Invalid ${params.parameterName}: expected ${params.expected}, got ${typeof params.actual}`;

    super({
      category: ErrorCategory.Validation,
      code: 'E034',
      message,
      recoverable: false,
    });

    this.name = 'InputValidationError';
    this.parameterName = params.parameterName;
    this.expected = params.expected;
    this.actual = params.actual;
  }
}

// ===============================================================================
// Validation Result Type
// ===============================================================================

/**
 * Result of a validation operation.
 */
export interface ValidationResult<T> {
  /** Whether validation passed */
  valid: boolean;
  /** The validated value (if valid) */
  value?: T;
  /** Error message (if invalid) */
  error?: string;
  /** Detailed errors for complex types */
  errors?: string[];
}

/**
 * Creates a successful validation result.
 */
function validResult<T>(value: T): ValidationResult<T> {
  return { valid: true, value };
}

/**
 * Creates a failed validation result.
 */
function invalidResult<T>(error: string, errors?: string[]): ValidationResult<T> {
  return { valid: false, error, errors };
}

// ===============================================================================
// Primitive Validators
// ===============================================================================

/**
 * Validates that a value is a non-empty string.
 */
export function validateString(
  value: unknown,
  paramName: string
): ValidationResult<string> {
  if (typeof value !== 'string') {
    return invalidResult(`${paramName} must be a string, got ${typeof value}`);
  }
  if (value.length === 0) {
    return invalidResult(`${paramName} cannot be empty`);
  }
  return validResult(value);
}

/**
 * Validates that a value is a positive integer.
 */
export function validatePositiveInteger(
  value: unknown,
  paramName: string
): ValidationResult<number> {
  if (typeof value !== 'number') {
    return invalidResult(`${paramName} must be a number, got ${typeof value}`);
  }
  if (!Number.isInteger(value)) {
    return invalidResult(`${paramName} must be an integer, got ${value}`);
  }
  if (value < 1) {
    return invalidResult(`${paramName} must be positive (>= 1), got ${value}`);
  }
  return validResult(value);
}

/**
 * Validates that a value is a boolean.
 */
export function validateBoolean(
  value: unknown,
  paramName: string
): ValidationResult<boolean> {
  if (typeof value !== 'boolean') {
    return invalidResult(`${paramName} must be a boolean, got ${typeof value}`);
  }
  return validResult(value);
}

// ===============================================================================
// API Type Validators
// ===============================================================================

/**
 * Validates a PositionSelector.
 */
export function validatePositionSelector(
  value: unknown,
  paramName = 'selector'
): ValidationResult<PositionSelector> {
  if (typeof value !== 'object' || value === null) {
    return invalidResult(`${paramName} must be an object`);
  }

  const obj = value as Record<string, unknown>;
  const errors: string[] = [];

  // Validate file
  const fileResult = validateString(obj.file, `${paramName}.file`);
  if (!fileResult.valid) {
    errors.push(fileResult.error!);
  }

  // Validate line
  const lineResult = validatePositiveInteger(obj.line, `${paramName}.line`);
  if (!lineResult.valid) {
    errors.push(lineResult.error!);
  }

  // Validate column
  const columnResult = validatePositiveInteger(obj.column, `${paramName}.column`);
  if (!columnResult.valid) {
    errors.push(columnResult.error!);
  }

  if (errors.length > 0) {
    return invalidResult(`Invalid PositionSelector`, errors);
  }

  return validResult({
    file: obj.file as string,
    line: obj.line as number,
    column: obj.column as number,
  });
}

/**
 * Validates a PathSelector.
 */
export function validatePathSelector(
  value: unknown,
  paramName = 'selector'
): ValidationResult<PathSelector> {
  if (typeof value !== 'object' || value === null) {
    return invalidResult(`${paramName} must be an object`);
  }

  const obj = value as Record<string, unknown>;
  const errors: string[] = [];

  // Validate file
  const fileResult = validateString(obj.file, `${paramName}.file`);
  if (!fileResult.valid) {
    errors.push(fileResult.error!);
  }

  // Validate path
  const pathResult = validateString(obj.path, `${paramName}.path`);
  if (!pathResult.valid) {
    errors.push(pathResult.error!);
  }

  if (errors.length > 0) {
    return invalidResult(`Invalid PathSelector`, errors);
  }

  return validResult({
    file: obj.file as string,
    path: obj.path as string,
  });
}

/**
 * Validates a Selector (either Position or Path based).
 */
export function validateSelector(
  value: unknown,
  paramName = 'selector'
): ValidationResult<Selector> {
  if (typeof value !== 'object' || value === null) {
    return invalidResult(`${paramName} must be an object`);
  }

  const obj = value as Record<string, unknown>;

  // Check if it's a PositionSelector
  if ('line' in obj && 'column' in obj) {
    return validatePositionSelector(value, paramName);
  }

  // Check if it's a PathSelector
  if ('path' in obj && typeof obj.path === 'string') {
    return validatePathSelector(value, paramName);
  }

  return invalidResult(
    `${paramName} must have either (file, line, column) or (file, path) properties`
  );
}

/**
 * Validates a Move enum value.
 */
export function validateMove(value: unknown, paramName = 'mode'): ValidationResult<Move> {
  if (!isValidMove(value)) {
    const validValues = ['inside', 'before', 'after'];
    return invalidResult(
      `${paramName} must be one of: ${validValues.join(', ')}, got "${String(value)}"`
    );
  }
  return validResult(value);
}

/**
 * Validates Options object.
 */
export function validateOptions(
  value: unknown,
  paramName = 'options'
): ValidationResult<Options> {
  // Options is optional, so undefined/null is valid
  if (value === undefined || value === null) {
    return validResult({});
  }

  if (typeof value !== 'object') {
    return invalidResult(`${paramName} must be an object, got ${typeof value}`);
  }

  const obj = value as Record<string, unknown>;
  const errors: string[] = [];

  // Validate optional fields
  if (obj.optimize !== undefined) {
    const result = validateBoolean(obj.optimize, `${paramName}.optimize`);
    if (!result.valid) errors.push(result.error!);
  }

  if (obj.dryRun !== undefined) {
    const result = validateBoolean(obj.dryRun, `${paramName}.dryRun`);
    if (!result.valid) errors.push(result.error!);
  }

  if (obj.preserveComments !== undefined) {
    const result = validateBoolean(obj.preserveComments, `${paramName}.preserveComments`);
    if (!result.valid) errors.push(result.error!);
  }

  if (obj.formatOutput !== undefined) {
    const result = validateBoolean(obj.formatOutput, `${paramName}.formatOutput`);
    if (!result.valid) errors.push(result.error!);
  }

  // Check for unknown properties
  const validProps = ['optimize', 'dryRun', 'preserveComments', 'formatOutput'];
  for (const key of Object.keys(obj)) {
    if (!validProps.includes(key)) {
      errors.push(`Unknown option: ${key}`);
    }
  }

  if (errors.length > 0) {
    return invalidResult(`Invalid Options`, errors);
  }

  return validResult(value as Options);
}

/**
 * Validates a FileInput object.
 */
export function validateFileInput(
  value: unknown,
  index: number
): ValidationResult<FileInput> {
  if (typeof value !== 'object' || value === null) {
    return invalidResult(`files[${index}] must be an object`);
  }

  const obj = value as Record<string, unknown>;
  const errors: string[] = [];

  // Validate path
  const pathResult = validateString(obj.path, `files[${index}].path`);
  if (!pathResult.valid) {
    errors.push(pathResult.error!);
  }

  // Validate content
  if (typeof obj.content !== 'string') {
    errors.push(`files[${index}].content must be a string`);
  }

  if (errors.length > 0) {
    return invalidResult(`Invalid FileInput at index ${index}`, errors);
  }

  return validResult({
    path: obj.path as string,
    content: obj.content as string,
  });
}

/**
 * Validates an array of FileInput objects.
 */
export function validateFileInputArray(
  value: unknown,
  paramName = 'files'
): ValidationResult<FileInput[]> {
  if (!Array.isArray(value)) {
    return invalidResult(`${paramName} must be an array`);
  }

  if (value.length === 0) {
    return invalidResult(`${paramName} must contain at least one file`);
  }

  const files: FileInput[] = [];
  const errors: string[] = [];

  for (let i = 0; i < value.length; i++) {
    const result = validateFileInput(value[i], i);
    if (result.valid) {
      files.push(result.value!);
    } else {
      errors.push(result.error!);
      if (result.errors) {
        errors.push(...result.errors);
      }
    }
  }

  if (errors.length > 0) {
    return invalidResult(`Invalid files array`, errors);
  }

  return validResult(files);
}

// ===============================================================================
// Comprehensive API Input Validation
// ===============================================================================

/**
 * Input parameters for the main regraft API.
 */
export interface RegraftInput {
  files: FileInput[];
  from: Selector;
  to: Selector;
  mode: Move;
  options?: Options;
}

/**
 * Validates all inputs for the regraft() function.
 */
export function validateRegraftInput(
  files: unknown,
  from: unknown,
  to: unknown,
  mode: unknown,
  options?: unknown
): ValidationResult<RegraftInput> {
  const errors: string[] = [];

  // Validate files
  const filesResult = validateFileInputArray(files, 'files');
  if (!filesResult.valid) {
    errors.push(filesResult.error!);
    if (filesResult.errors) errors.push(...filesResult.errors);
  }

  // Validate from selector
  const fromResult = validateSelector(from, 'from');
  if (!fromResult.valid) {
    errors.push(fromResult.error!);
    if (fromResult.errors) errors.push(...fromResult.errors);
  }

  // Validate to selector
  const toResult = validateSelector(to, 'to');
  if (!toResult.valid) {
    errors.push(toResult.error!);
    if (toResult.errors) errors.push(...toResult.errors);
  }

  // Validate mode
  const modeResult = validateMove(mode, 'mode');
  if (!modeResult.valid) {
    errors.push(modeResult.error!);
  }

  // Validate options (optional)
  const optionsResult = validateOptions(options, 'options');
  if (!optionsResult.valid) {
    errors.push(optionsResult.error!);
    if (optionsResult.errors) errors.push(...optionsResult.errors);
  }

  if (errors.length > 0) {
    return invalidResult('Invalid input parameters', errors);
  }

  // Additional cross-field validations
  const validatedFiles = filesResult.value!;
  const validatedFrom = fromResult.value!;
  const validatedTo = toResult.value!;

  // Check that from.file exists in files array
  const fromFileExists = validatedFiles.some(f => f.path === validatedFrom.file);
  if (!fromFileExists) {
    errors.push(
      `from.file "${validatedFrom.file}" not found in files array. ` +
        `Available files: ${validatedFiles.map(f => f.path).join(', ')}`
    );
  }

  // Check that to.file exists in files array
  const toFileExists = validatedFiles.some(f => f.path === validatedTo.file);
  if (!toFileExists) {
    errors.push(
      `to.file "${validatedTo.file}" not found in files array. ` +
        `Available files: ${validatedFiles.map(f => f.path).join(', ')}`
    );
  }

  if (errors.length > 0) {
    return invalidResult('Invalid input parameters', errors);
  }

  return validResult({
    files: validatedFiles,
    from: validatedFrom,
    to: validatedTo,
    mode: modeResult.value!,
    options: optionsResult.value,
  });
}

// ===============================================================================
// Assertion Helpers
// ===============================================================================

/**
 * Validates input and throws InputValidationError if invalid.
 */
export function assertRegraftInput(
  files: unknown,
  from: unknown,
  to: unknown,
  mode: unknown,
  options?: unknown
): asserts files is FileInput[] {
  const result = validateRegraftInput(files, from, to, mode, options);

  if (!result.valid) {
    throw new InputValidationError({
      parameterName: 'input',
      expected: 'valid regraft parameters',
      actual: { files, from, to, mode, options },
      message: result.errors?.join('\n') ?? result.error,
    });
  }
}

/**
 * Validates selector and throws InputValidationError if invalid.
 */
export function assertSelector(value: unknown, paramName = 'selector'): asserts value is Selector {
  const result = validateSelector(value, paramName);

  if (!result.valid) {
    throw new InputValidationError({
      parameterName: paramName,
      expected: 'Selector (PositionSelector or PathSelector)',
      actual: value,
      message: result.errors?.join('\n') ?? result.error,
    });
  }
}

/**
 * Validates move mode and throws InputValidationError if invalid.
 */
export function assertMove(value: unknown, paramName = 'mode'): asserts value is Move {
  const result = validateMove(value, paramName);

  if (!result.valid) {
    throw new InputValidationError({
      parameterName: paramName,
      expected: 'Move (inside, before, or after)',
      actual: value,
      message: result.error,
    });
  }
}

/**
 * Validates options and throws InputValidationError if invalid.
 */
export function assertOptions(value: unknown, paramName = 'options'): asserts value is Options | undefined {
  const result = validateOptions(value, paramName);

  if (!result.valid) {
    throw new InputValidationError({
      parameterName: paramName,
      expected: 'Options object or undefined',
      actual: value,
      message: result.errors?.join('\n') ?? result.error,
    });
  }
}
