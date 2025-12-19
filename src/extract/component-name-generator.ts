/**
 * ComponentNameGenerator
 *
 * Task 5.2: ComponentNameGenerator 구현
 * Generates unique component names following React naming conventions
 */

import { ok, err, type Result } from '../result/index.js';
import type { RegraffError } from '../errors/error-category.js';
import { createExtractError, ExtractErrorCode } from './errors.js';

/**
 * ComponentNameGenerator
 * Handles component name generation and uniqueness
 */
export class ComponentNameGenerator {
  private static readonly DEFAULT_NAME = 'ExtractedComponent';
  private static readonly VALID_NAME_PATTERN = /^[A-Z][A-Za-z0-9]*$/;

  /**
   * Generate a unique component name
   *
   * @param existingNames - Set of existing component names
   * @param suggestedName - Optional suggested name
   * @returns Result with unique component name in PascalCase or error
   */
  generate(existingNames: Set<string>, suggestedName?: string): Result<string, RegraffError> {
    // Use default name if no suggestion provided (use ?? to handle empty string)
    const baseName =
      suggestedName !== undefined
        ? suggestedName
        : ComponentNameGenerator.DEFAULT_NAME;

    // Convert to PascalCase
    const pascalName = this.toPascalCase(baseName);

    // Return error for empty name (after conversion)
    if (pascalName === '') {
      return err(createExtractError(ExtractErrorCode.INVALID_COMPONENT_NAME, {
        details: 'Component name cannot be empty',
      }));
    }

    // Validate the name follows React conventions
    const validationResult = this.validateComponentName(pascalName);
    if (!validationResult.ok) {
      return validationResult;
    }

    // Ensure uniqueness
    const uniqueName = this.ensureUnique(pascalName, existingNames);
    return ok(uniqueName);
  }

  /**
   * Ensure component name is unique by adding numeric suffix if needed
   *
   * @param name - Component name to check
   * @param existingNames - Set of existing component names
   * @returns Unique component name
   */
  ensureUnique(name: string, existingNames: Set<string>): string {
    // Return as-is if no conflict
    if (!existingNames.has(name)) {
      return name;
    }

    // Find the next available suffix
    let suffix = 2;
    let uniqueName = `${name}${suffix}`;

    while (existingNames.has(uniqueName)) {
      suffix++;
      uniqueName = `${name}${suffix}`;
    }

    return uniqueName;
  }

  /**
   * Convert string to PascalCase
   *
   * @param name - String to convert
   * @returns PascalCase string
   */
  private toPascalCase(name: string): string {
    // Handle different naming conventions:
    // - camelCase -> PascalCase
    // - kebab-case -> PascalCase
    // - snake_case -> PascalCase
    // - UPPER_CASE -> PascalCase

    return name
      // Split by delimiters (-, _, space)
      .split(/[-_\s]+/)
      // Filter out empty strings
      .filter((word) => word.length > 0)
      // Capitalize first letter of each word
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      // Join all words
      .join('');
  }

  /**
   * Validate component name follows React conventions
   *
   * @param name - Component name to validate
   * @returns Result with void or error if name is invalid
   */
  private validateComponentName(name: string): Result<void, RegraffError> {
    // Must start with uppercase letter and contain only alphanumeric characters
    if (!ComponentNameGenerator.VALID_NAME_PATTERN.test(name)) {
      let reason = 'Component name must start with an uppercase letter';

      if (/^[0-9]/.test(name)) {
        reason = 'Component name cannot start with a number';
      } else if (/[^A-Za-z0-9]/.test(name)) {
        reason = 'Component name can only contain letters and numbers';
      } else if (/^[a-z]/.test(name)) {
        reason = 'Component name must start with an uppercase letter';
      }

      return err(createExtractError(ExtractErrorCode.INVALID_COMPONENT_NAME, {
        details: reason,
      }));
    }

    return ok(undefined);
  }
}
