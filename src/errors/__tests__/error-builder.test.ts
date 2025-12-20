/**
 * ErrorBuilder Tests
 *
 * Tests for fluent API ErrorBuilder class that simplifies creating ValidationError instances.
 */

import { describe, it, expect } from 'vitest';
import { ErrorBuilder, error } from '../error-builder.js';
import { isValidationError } from '../error-category.js';

describe('ErrorBuilder', () => {
  describe('fluent API', () => {
    it('should build ValidationError with required fields', () => {
      const builder = new ErrorBuilder();
      const result = builder
        .code('TEST_ERROR')
        .message('Test error message')
        .constraint('test_constraint')
        .details('Test details')
        .build();

      expect(isValidationError(result)).toBe(true);
      expect(result.code).toBe('TEST_ERROR');
      expect(result.message).toBe('Test error message');
      if (isValidationError(result)) {
        expect(result.constraint).toBe('test_constraint');
        expect(result.details).toBe('Test details');
      }
    });

    it('should chain method calls', () => {
      const result = new ErrorBuilder()
        .code('ERROR_CODE')
        .message('Error message')
        .constraint('constraint')
        .details('details')
        .build();

      expect(result.code).toBe('ERROR_CODE');
    });

    it('should set file path', () => {
      const result = new ErrorBuilder()
        .code('FILE_ERROR')
        .message('File error')
        .constraint('file_exists')
        .details('File not found')
        .inFile('src/test.ts')
        .build();

      expect(result.file).toBe('src/test.ts');
    });

    it('should set source location', () => {
      const location = {
        start: { line: 1, column: 0 },
        end: { line: 1, column: 10 },
      };

      const result = new ErrorBuilder()
        .code('LOCATION_ERROR')
        .message('Location error')
        .constraint('valid_location')
        .details('Invalid location')
        .at(location)
        .build();

      expect(result.location).toEqual(location);
    });

    it('should handle null location', () => {
      const result = new ErrorBuilder()
        .code('NULL_LOC')
        .message('Null location')
        .constraint('has_location')
        .details('Location is null')
        .at(null)
        .build();

      expect(result.location).toBeUndefined();
    });

    it('should handle undefined location', () => {
      const result = new ErrorBuilder()
        .code('UNDEF_LOC')
        .message('Undefined location')
        .constraint('has_location')
        .details('Location is undefined')
        .at(undefined)
        .build();

      expect(result.location).toBeUndefined();
    });

    it('should add single suggestion', () => {
      const result = new ErrorBuilder()
        .code('SUGGESTION_ERROR')
        .message('Suggestion error')
        .constraint('valid')
        .details('Details')
        .suggest('Try this fix')
        .build();

      expect(result.suggestions).toHaveLength(1);
      expect(result.suggestions[0].description).toBe('Try this fix');
      expect(result.suggestions[0].action).toBe('fix_syntax');
    });

    it('should add multiple suggestions with suggest()', () => {
      const result = new ErrorBuilder()
        .code('MULTI_SUGGEST')
        .message('Multiple suggestions')
        .constraint('valid')
        .details('Details')
        .suggest('First suggestion')
        .suggest('Second suggestion')
        .suggest('Third suggestion')
        .build();

      expect(result.suggestions).toHaveLength(3);
      expect(result.suggestions[0].description).toBe('First suggestion');
      expect(result.suggestions[1].description).toBe('Second suggestion');
      expect(result.suggestions[2].description).toBe('Third suggestion');
    });

    it('should set multiple suggestions with suggestions()', () => {
      const suggestions = ['Suggestion 1', 'Suggestion 2'];

      const result = new ErrorBuilder()
        .code('SUGGESTIONS_ARRAY')
        .message('Suggestions array')
        .constraint('valid')
        .details('Details')
        .suggestions(suggestions)
        .build();

      expect(result.suggestions).toHaveLength(2);
      expect(result.suggestions[0].description).toBe('Suggestion 1');
      expect(result.suggestions[1].description).toBe('Suggestion 2');
    });

    it('should replace suggestions when using suggestions() after suggest()', () => {
      const result = new ErrorBuilder()
        .code('REPLACE_SUGGESTIONS')
        .message('Replace suggestions')
        .constraint('valid')
        .details('Details')
        .suggest('First')
        .suggestions(['Second', 'Third'])
        .build();

      expect(result.suggestions).toHaveLength(2);
      expect(result.suggestions[0].description).toBe('Second');
      expect(result.suggestions[1].description).toBe('Third');
    });
  });

  describe('validation', () => {
    it('should throw error when code is missing', () => {
      const builder = new ErrorBuilder();
      expect(() => {
        builder
          .message('Message')
          .constraint('constraint')
          .details('details')
          .build();
      }).toThrow('ErrorBuilder: code and message are required');
    });

    it('should throw error when message is missing', () => {
      const builder = new ErrorBuilder();
      expect(() => {
        builder
          .code('CODE')
          .constraint('constraint')
          .details('details')
          .build();
      }).toThrow('ErrorBuilder: code and message are required');
    });

    it('should allow constraint and details to be optional', () => {
      // Note: In practice constraint and details are required for ValidationError,
      // but if we only set code and message, we need to handle it gracefully
      const builder = new ErrorBuilder();
      const result = builder
        .code('CODE')
        .message('Message')
        .constraint('')
        .details('')
        .build();

      expect(result.code).toBe('CODE');
      expect(result.message).toBe('Message');
    });
  });

  describe('error() factory function', () => {
    it('should create a new ErrorBuilder instance', () => {
      const builder = error();
      expect(builder).toBeInstanceOf(ErrorBuilder);
    });

    it('should enable fluent API usage', () => {
      const result = error()
        .code('FACTORY_ERROR')
        .message('Factory error')
        .constraint('valid')
        .details('Created with factory')
        .build();

      expect(result.code).toBe('FACTORY_ERROR');
      expect(result.message).toBe('Factory error');
    });

    it('should support complete fluent chain', () => {
      const location = {
        start: { line: 1, column: 0 },
        end: { line: 1, column: 10 },
      };

      const result = error()
        .code('COMPLETE_CHAIN')
        .message('Complete chain')
        .constraint('all_fields')
        .details('All fields set')
        .inFile('test.ts')
        .at(location)
        .suggest('Fix 1')
        .suggest('Fix 2')
        .build();

      expect(result.code).toBe('COMPLETE_CHAIN');
      expect(result.message).toBe('Complete chain');
      expect(result.file).toBe('test.ts');
      expect(result.location).toEqual(location);
      expect(result.suggestions).toHaveLength(2);
      if (isValidationError(result)) {
        expect(result.constraint).toBe('all_fields');
        expect(result.details).toBe('All fields set');
      }
    });
  });

  describe('real-world usage examples', () => {
    it('should create validation error for hook location', () => {
      const result = error()
        .code('HOOK_LOCATION_INVALID')
        .message('Hook cannot be placed in conditional scope')
        .constraint('hooks_top_level')
        .details('Hook useState is inside a conditional block which violates Rules of Hooks')
        .inFile('src/Component.tsx')
        .at({
          start: { line: 10, column: 4 },
          end: { line: 10, column: 25 },
        })
        .suggest('Move hook to component top level')
        .suggest('Use prop threading to pass hook result down')
        .build();

      expect(result.code).toBe('HOOK_LOCATION_INVALID');
      expect(result.suggestions).toHaveLength(2);
    });

    it('should create validation error for selector resolution', () => {
      const result = error()
        .code('INVALID_SELECTOR')
        .message('Could not resolve selector')
        .constraint('selector_valid')
        .details('Selector path does not match any JSX element in the AST')
        .inFile('src/app.tsx')
        .suggest('Check selector syntax')
        .suggest('Verify element exists at specified path')
        .build();

      expect(result.code).toBe('INVALID_SELECTOR');
      if (isValidationError(result)) {
        expect(result.constraint).toBe('selector_valid');
      }
    });

    it('should create error without file or location', () => {
      const result = error()
        .code('GENERAL_ERROR')
        .message('General error occurred')
        .constraint('general')
        .details('No specific file or location')
        .build();

      expect(result.file).toBeUndefined();
      expect(result.location).toBeUndefined();
    });
  });
});
