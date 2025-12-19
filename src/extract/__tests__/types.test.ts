/**
 * Extract Types Test
 *
 * Tests for extract feature type definitions
 * Task 1.2: Core data model type definitions
 */

import { describe, it, expect } from 'vitest';
import type {
  ExtractOptions,
  RangeSelector,
  ExtractResult,
  ComponentInfo,
  PropInfo,
  ExtractStats,
  ExtractPlan,
  ExtractDependencies,
  VariableDependency,
  FunctionDependency,
  StateDependency,
  HookDependency,
  ImportDependency,
  PropType,
  HookDeclaration,
  FormattingOptions,
} from '../types.js';

describe('Extract Types', () => {
  describe('ExtractOptions', () => {
    it('should allow componentName as optional string', () => {
      const options: ExtractOptions = {
        componentName: 'MyComponent',
      };
      expect(options.componentName).toBe('MyComponent');
    });

    it('should allow targetFile as optional string', () => {
      const options: ExtractOptions = {
        targetFile: 'components/MyComponent.tsx',
      };
      expect(options.targetFile).toBe('components/MyComponent.tsx');
    });

    it('should allow generateTypes as optional boolean', () => {
      const options: ExtractOptions = {
        generateTypes: false,
      };
      expect(options.generateTypes).toBe(false);
    });

    it('should allow empty options object', () => {
      const options: ExtractOptions = {};
      expect(options).toEqual({});
    });
  });

  describe('RangeSelector', () => {
    it('should have file, start, and end properties', () => {
      const selector: RangeSelector = {
        file: 'App.tsx',
        start: { line: 10, column: 5 },
        end: { line: 15, column: 20 },
      };

      expect(selector.file).toBe('App.tsx');
      expect(selector.start.line).toBe(10);
      expect(selector.start.column).toBe(5);
      expect(selector.end.line).toBe(15);
      expect(selector.end.column).toBe(20);
    });
  });

  describe('ExtractResult', () => {
    it('should have codes, component, and stats properties', () => {
      const result: ExtractResult = {
        codes: [
          {
            file: 'App.tsx',
            content: 'const App = () => <div />;',
            changed: true,
          },
        ],
        component: {
          name: 'ExtractedComponent',
          file: 'App.tsx',
          props: [],
        },
        stats: {
          nodesExtracted: 1,
          dependenciesFound: 0,
          propsGenerated: 0,
        },
      };

      expect(result.codes).toHaveLength(1);
      expect(result.component.name).toBe('ExtractedComponent');
      expect(result.stats.nodesExtracted).toBe(1);
    });
  });

  describe('ComponentInfo', () => {
    it('should have name, file, and props properties', () => {
      const component: ComponentInfo = {
        name: 'UserProfile',
        file: 'components/UserProfile.tsx',
        props: [],
      };

      expect(component.name).toBe('UserProfile');
      expect(component.file).toBe('components/UserProfile.tsx');
      expect(component.props).toEqual([]);
    });

    it('should allow optional propsInterface', () => {
      const component: ComponentInfo = {
        name: 'UserProfile',
        file: 'components/UserProfile.tsx',
        propsInterface: 'UserProfileProps',
        props: [],
      };

      expect(component.propsInterface).toBe('UserProfileProps');
    });
  });

  describe('PropInfo', () => {
    it('should have name, type, and optional properties', () => {
      const prop: PropInfo = {
        name: 'userName',
        type: 'string',
        optional: false,
      };

      expect(prop.name).toBe('userName');
      expect(prop.type).toBe('string');
      expect(prop.optional).toBe(false);
    });
  });

  describe('ExtractStats', () => {
    it('should have nodesExtracted, dependenciesFound, and propsGenerated', () => {
      const stats: ExtractStats = {
        nodesExtracted: 3,
        dependenciesFound: 2,
        propsGenerated: 2,
      };

      expect(stats.nodesExtracted).toBe(3);
      expect(stats.dependenciesFound).toBe(2);
      expect(stats.propsGenerated).toBe(2);
    });
  });

  describe('ExtractPlan', () => {
    it('should have all required properties for extraction planning', () => {
      const plan: ExtractPlan = {
        selectedNodes: [],
        sourceFile: 'App.tsx',
        targetFile: 'App.tsx',
        componentName: 'ExtractedComponent',
        propsInterfaceName: 'ExtractedComponentProps',
        dependencies: {
          variables: [],
          functions: [],
          states: [],
          hooks: [],
          imports: [],
        },
        propTypes: [],
        hooksToMove: [],
        isSameFile: true,
      };

      expect(plan.sourceFile).toBe('App.tsx');
      expect(plan.targetFile).toBe('App.tsx');
      expect(plan.componentName).toBe('ExtractedComponent');
      expect(plan.isSameFile).toBe(true);
    });
  });

  describe('ExtractDependencies', () => {
    it('should have arrays for all dependency types', () => {
      const deps: ExtractDependencies = {
        variables: [],
        functions: [],
        states: [],
        hooks: [],
        imports: [],
      };

      expect(Array.isArray(deps.variables)).toBe(true);
      expect(Array.isArray(deps.functions)).toBe(true);
      expect(Array.isArray(deps.states)).toBe(true);
      expect(Array.isArray(deps.hooks)).toBe(true);
      expect(Array.isArray(deps.imports)).toBe(true);
    });
  });

  describe('FormattingOptions', () => {
    it('should allow optional formatting configuration', () => {
      const formatting: FormattingOptions = {
        indentSize: 2,
        useTabs: false,
        quotes: 'single',
        semi: true,
      };

      expect(formatting.indentSize).toBe(2);
      expect(formatting.useTabs).toBe(false);
      expect(formatting.quotes).toBe('single');
      expect(formatting.semi).toBe(true);
    });

    it('should allow partial formatting options', () => {
      const formatting: FormattingOptions = {
        quotes: 'double',
      };

      expect(formatting.quotes).toBe('double');
    });
  });
});
