/**
 * ExtractPlanner
 *
 * Task 8.2: Basic ExtractPlanner implementation
 * Plans the extraction of JSX nodes into a new component
 */

import * as t from '@babel/types';

import type { RegraffError } from '../errors/error-category.js';
import { ok, err, type Result } from '../result/index.js';
import { ScopeManager } from '../scope/index.js';
import { ScopeType, createScopeInfo } from '../types/index.js';
import type { FileInput, Selector } from '../types/public.js';

import { ComponentNameGenerator } from './component-name-generator.js';
import { createExtractError, ExtractErrorCode } from './errors.js';
import { ExtractDependencyAnalyzer } from './extract-dependency-analyzer.js';
import type { IExtractPlanner } from './interfaces/i-extract-planner.js';
import { createNodeSelector, type INodeSelector } from './node-selector.js';
import { TypeInferrer } from './type-inferrer.js';
import type { ExtractOptions, ExtractPlan, RangeSelector } from './types.js';

/**
 * ExtractPlanner
 *
 * Responsible for planning the extraction of JSX nodes:
 * - Selecting nodes using NodeSelector
 * - Analyzing dependencies using DependencyAnalyzer
 * - Generating component name
 * - Creating an extraction plan
 */
export class ExtractPlanner implements IExtractPlanner {
  private readonly nodeSelector: INodeSelector;
  private readonly componentNameGenerator: ComponentNameGenerator;

  constructor() {
    this.nodeSelector = createNodeSelector();
    this.componentNameGenerator = new ComponentNameGenerator();
  }

  /**
   * Create an extraction plan
   *
   * @param files - File inputs
   * @param asts - Parsed AST map
   * @param selector - Selector to locate JSX nodes
   * @param options - Extract options
   * @returns Result with ExtractPlan or error
   */
  plan(
    files: FileInput[],
    asts: Map<string, t.File>,
    selector: Selector | RangeSelector,
    options: ExtractOptions
  ): Result<ExtractPlan, RegraffError> {
    // Step 1: Validate inputs
    if (files.length === 0) {
      return err(
        createExtractError(ExtractErrorCode.EMPTY_INPUT, {
          details: 'Files array is empty',
        })
      );
    }

    // Step 2: Find the source file and AST
    const sourceFile = selector.file;
    const fileInput = files.find(f => f.path === sourceFile);

    if (!fileInput) {
      return err(
        createExtractError(ExtractErrorCode.FILE_NOT_FOUND, {
          file: sourceFile,
          details: `Source file not found: ${sourceFile}`,
        })
      );
    }

    const ast = asts.get(sourceFile);
    if (!ast) {
      return err(
        createExtractError(ExtractErrorCode.FILE_READ_FAILED, {
          file: sourceFile,
          details: `AST not found for file: ${sourceFile}`,
        })
      );
    }

    // Step 3: Select JSX nodes
    const selectResult = this.nodeSelector.selectNodes(ast, selector);
    if (!selectResult.ok) {
      return selectResult;
    }

    const selectedNodes = selectResult.value;
    const [firstSelectedNode] = selectedNodes;
    if (!firstSelectedNode) {
      return err(
        createExtractError(ExtractErrorCode.INVALID_SELECTION, {
          selector: this.normalizeSelector(selector),
          file: sourceFile,
          details: 'No JSX nodes selected',
        })
      );
    }

    // Step 4: Analyze dependencies
    const scopeManager = new ScopeManager();
    const dependencyAnalyzer = new ExtractDependencyAnalyzer(scopeManager);

    // Create a module-level scope for dependency analysis
    const sourceScope = createScopeInfo({
      type: ScopeType.Module,
      path: firstSelectedNode.scope.getProgramParent().path,
      parent: null,
    });
    const dependencyResult = dependencyAnalyzer.analyze(selectedNodes, sourceScope);

    if (!dependencyResult.ok) {
      return dependencyResult;
    }

    const dependencies = dependencyResult.value;

    // Step 5: Infer prop types from dependencies
    const typeInferrer = new TypeInferrer();

    // Combine variables, functions, and states into a single array for type inference
    const allDependencies = [
      ...dependencies.variables,
      ...dependencies.functions,
    ];

    const propTypesResult = typeInferrer.inferPropTypes(allDependencies);
    if (!propTypesResult.ok) {
      return propTypesResult;
    }

    const propTypes = [...propTypesResult.value];

    // Add state dependencies as props (both state variable and setter)
    for (const state of dependencies.states) {
      propTypes.push({
        name: state.stateName,
        typeAnnotation: state.type ?? t.tsUnknownKeyword(),
        optional: false,
      });
      propTypes.push({
        name: state.setterName,
        typeAnnotation: t.tsUnknownKeyword(), // Setter is always a function
        optional: false,
      });
    }

    // Add import dependencies as props
    for (const importDep of dependencies.imports) {
      propTypes.push({
        name: importDep.name,
        typeAnnotation: t.tsUnknownKeyword(),
        optional: false,
      });
    }

    // Step 6: Generate component name
    const existingNames = new Set<string>();
    const componentNameResult = this.componentNameGenerator.generate(
      existingNames,
      options.componentName
    );

    if (!componentNameResult.ok) {
      return componentNameResult;
    }

    const componentName = componentNameResult.value;
    const propsInterfaceName = `${componentName}Props`;

    // Step 7: Determine target file
    const targetFile = options.targetFile ?? sourceFile;
    const isSameFile = targetFile === sourceFile;

    // Step 8: Create extraction plan
    const plan: ExtractPlan = {
      selectedNodes,
      sourceFile,
      targetFile,
      componentName,
      propsInterfaceName,
      dependencies,
      propTypes,
      hooksToMove: [],
      isSameFile,
    };

    return ok(plan);
  }

  private normalizeSelector(selector: Selector | RangeSelector): Selector {
    if ('line' in selector && 'column' in selector) {
      return selector;
    }
    if ('path' in selector) {
      return selector;
    }
    if ('start' in selector && 'end' in selector) {
      return {
        file: selector.file,
        line: selector.start.line,
        column: selector.start.column,
      };
    }
    return { file: '', line: 1, column: 1 };
  }

}
