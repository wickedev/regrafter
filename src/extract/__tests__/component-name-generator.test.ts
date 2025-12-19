/**
 * ComponentNameGenerator Test
 *
 * Tests for component name generation and uniqueness
 * Task 5.1: ComponentNameGenerator 테스트 작성
 */

import { describe, it, expect } from 'vitest';
import { ComponentNameGenerator } from '../component-name-generator.js';

describe('ComponentNameGenerator', () => {
  describe('generate', () => {
    it('should use suggested name when provided', () => {
      const generator = new ComponentNameGenerator();
      const existingNames = new Set<string>();

      const result = generator.generate(existingNames, 'UserProfile');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe('UserProfile');
      }
    });

    it('should generate default name when no name is provided', () => {
      const generator = new ComponentNameGenerator();
      const existingNames = new Set<string>();

      const result = generator.generate(existingNames);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe('ExtractedComponent');
      }
    });

    it('should convert name to PascalCase', () => {
      const generator = new ComponentNameGenerator();
      const existingNames = new Set<string>();

      const result = generator.generate(existingNames, 'user-profile');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe('UserProfile');
      }
    });

    it('should convert camelCase to PascalCase', () => {
      const generator = new ComponentNameGenerator();
      const existingNames = new Set<string>();

      const result = generator.generate(existingNames, 'userProfile');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe('UserProfile');
      }
    });

    it('should convert kebab-case to PascalCase', () => {
      const generator = new ComponentNameGenerator();
      const existingNames = new Set<string>();

      const result = generator.generate(existingNames, 'user-profile-card');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe('UserProfileCard');
      }
    });

    it('should convert snake_case to PascalCase', () => {
      const generator = new ComponentNameGenerator();
      const existingNames = new Set<string>();

      const result = generator.generate(existingNames, 'user_profile_card');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe('UserProfileCard');
      }
    });

    it('should add numeric suffix when name conflicts', () => {
      const generator = new ComponentNameGenerator();
      const existingNames = new Set(['MyComponent']);

      const result = generator.generate(existingNames, 'MyComponent');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe('MyComponent2');
      }
    });

    it('should increment suffix until unique name is found', () => {
      const generator = new ComponentNameGenerator();
      const existingNames = new Set(['MyComponent', 'MyComponent2', 'MyComponent3']);

      const result = generator.generate(existingNames, 'MyComponent');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe('MyComponent4');
      }
    });

    it('should return error for invalid component name (starts with number)', () => {
      const generator = new ComponentNameGenerator();
      const existingNames = new Set<string>();

      const result = generator.generate(existingNames, '123Component');

      expect(result.ok).toBe(false);
    });

    it('should return error for invalid component name (contains special characters)', () => {
      const generator = new ComponentNameGenerator();
      const existingNames = new Set<string>();

      const result = generator.generate(existingNames, 'My@Component');

      expect(result.ok).toBe(false);
    });

    it('should return error for empty name', () => {
      const generator = new ComponentNameGenerator();
      const existingNames = new Set<string>();

      const result = generator.generate(existingNames, '');

      expect(result.ok).toBe(false);
    });
  });

  describe('ensureUnique', () => {
    it('should return name as-is when no conflict', () => {
      const generator = new ComponentNameGenerator();
      const existingNames = new Set(['OtherComponent']);

      const result = generator.ensureUnique('MyComponent', existingNames);

      expect(result).toBe('MyComponent');
    });

    it('should add suffix when name conflicts', () => {
      const generator = new ComponentNameGenerator();
      const existingNames = new Set(['MyComponent']);

      const result = generator.ensureUnique('MyComponent', existingNames);

      expect(result).toBe('MyComponent2');
    });

    it('should increment suffix until finding unique name', () => {
      const generator = new ComponentNameGenerator();
      const existingNames = new Set(['Component', 'Component2', 'Component3']);

      const result = generator.ensureUnique('Component', existingNames);

      expect(result).toBe('Component4');
    });

    it('should handle large number of conflicts', () => {
      const generator = new ComponentNameGenerator();
      const existingNames = new Set<string>();

      // Create conflicts from 1 to 99
      for (let i = 1; i <= 99; i++) {
        existingNames.add(i === 1 ? 'Test' : `Test${i}`);
      }

      const result = generator.ensureUnique('Test', existingNames);

      expect(result).toBe('Test100');
    });
  });
});
