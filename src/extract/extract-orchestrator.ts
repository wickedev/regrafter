/**
 * ExtractOrchestrator
 *
 * Task 10.2: Basic ExtractOrchestrator implementation
 *
 * Requirements:
 * - 1.1: Select and extract JSX nodes
 * - 2.1: Automatic dependency analysis
 * - 3.1: Extract component within same file
 * - 10.7: Return generated file paths and change summary
 */

import type * as t from '@babel/types';

import type { RegraffError } from '../errors/error-category.js';
import { parseFile } from '../parser/index.js';
import { err, ok, type Result } from '../result/types.js';
import type { Code, FileInput, Selector } from '../types/public.js';

import { CodeFormatter } from './CodeFormatter.js';
import { createExtractError, ExtractErrorCode } from './errors.js';
import { ExtractExecutor } from './extract-executor.js';
import { ExtractPlanner } from './extract-planner.js';
import { InputValidator } from './input-validator.js';
import { TypeStringifier } from './type-stringifier.js';
import type {
  ExtractPlan,
  ExtractOptions,
  ExtractResult,
  ExtractAnalysis,
  RangeSelector,
} from './types.js';

/**
 * ExtractOrchestrator
 *
 * Class that orchestrates entire Extract operation workflow
 *
 * Responsibilities:
 * - Input validation (InputValidator)
 * - File parsing
 * - Extract planning (ExtractPlanner)
 * - Plan execution (ExtractExecutor)
 * - Code formatting (CodeFormatter)
 * - Result generation (ExtractResult)
 *
 * Based on design.md section ExtractOrchestrator
 */
export class ExtractOrchestrator {
  private readonly inputValidator: InputValidator;
  private readonly extractPlanner: ExtractPlanner;
  private readonly extractExecutor: ExtractExecutor;
  private readonly codeFormatter: CodeFormatter;
  private readonly typeStringifier: TypeStringifier;

  constructor() {
    this.inputValidator = new InputValidator();
    this.extractPlanner = new ExtractPlanner();
    this.extractExecutor = new ExtractExecutor();
    this.codeFormatter = new CodeFormatter();
    this.typeStringifier = new TypeStringifier();
  }

  /**
   * Orchestrate entire Extract operation workflow
   *
   * @param files - Array of file inputs
   * @param selector - Selector or RangeSelector to select JSX nodes
   * @param options - Extract options
   * @returns ExtractResult or error
   *
   * Workflow:
   * 1. Input validation
   * 2. File parsing
   * 3. Extract planning
   * 4. Plan execution
   * 5. Code formatting
   * 6. Result generation
   */
  orchestrate(
    files: FileInput[],
    selector: Selector | RangeSelector,
    options: ExtractOptions
  ): Result<ExtractResult, RegraffError> {
    // Steps 1-3: Initialize (validate, parse, plan)
    const initResult = this.initialize(files, selector, options);
    if (!initResult.ok) {
      return initResult;
    }

    const { astMap, plan } = initResult.value;

    // Step 4: Plan execution
    const executeResult = this.extractExecutor.execute(plan, astMap);
    if (!executeResult.ok) {
      return executeResult;
    }

    const updatedAsts = executeResult.value;

    // Step 5: Code formatting
    const codes: Code[] = [];

    for (const [filePath, ast] of updatedAsts) {
      const originalFile = files.find(f => f.path === filePath);
      const originalContent = originalFile?.content ?? '';

      const formatResult = this.codeFormatter.format(ast, originalContent);
      if (!formatResult.ok) {
        return formatResult;
      }

      const changed = formatResult.value !== originalContent;

      codes.push({
        file: filePath,
        content: formatResult.value,
        changed,
        isNew: originalFile === undefined,
        original: changed ? originalContent : undefined,
      });
    }

    // Step 6: Result generation
    const result: ExtractResult = {
      codes,
      component: {
        name: plan.componentName,
        file: plan.targetFile,
        propsInterface: plan.propTypes.length > 0 ? plan.propsInterfaceName : undefined,
        props: plan.propTypes.map(pt => ({
          name: pt.name,
          type: this.typeStringifier.toString(pt.typeAnnotation),
          optional: pt.optional,
        })),
      },
      stats: {
        nodesExtracted: plan.selectedNodes.length,
        dependenciesFound:
          plan.dependencies.variables.length +
          plan.dependencies.functions.length +
          plan.dependencies.states.length +
          plan.dependencies.hooks.length,
        propsGenerated: plan.propTypes.length,
      },
    };

    return ok(result);
  }

  /**
   * Validate extraction possibility only (dry-run)
   *
   * Task 21.2: canExtract() function implementation
   *
   * @param files - Array of file inputs
   * @param selector - Selector or RangeSelector to select JSX nodes
   * @returns Whether extraction is possible
   *
   * Performs validation only without actual transformation.
   * Returns false on validation failure.
   */
  validate(
    files: FileInput[],
    selector: Selector | RangeSelector
  ): boolean {
    // Steps 1-3: Initialize (validate, parse, plan)
    const initResult = this.initialize(files, selector, {});

    // If planning succeeds, extraction is possible
    return initResult.ok;
  }

  /**
   * Perform extraction analysis only (without transformation)
   *
   * Task 21.4: analyzeExtract() function implementation
   *
   * @param files - Array of file inputs
   * @param selector - Selector or RangeSelector to select JSX nodes
   * @returns ExtractAnalysis or error
   *
   * Performs only dependency analysis and planning, not actual transformation.
   *
   * Requirements:
   * - 2.5: Perform dependency analysis only and skip code transformation
   */
  analyze(
    files: FileInput[],
    selector: Selector | RangeSelector
  ): Result<ExtractAnalysis, RegraffError> {
    // Steps 1-3: Initialize (validate, parse, plan)
    const initResult = this.initialize(files, selector, {});
    if (!initResult.ok) {
      return initResult;
    }

    const { plan } = initResult.value;

    // Step 4: Convert plan to ExtractAnalysis
    const analysis: ExtractAnalysis = {
      selectedNodesCount: plan.selectedNodes.length,
      dependencies: {
        variables: plan.dependencies.variables.map(v => v.name),
        functions: plan.dependencies.functions.map(f => f.name),
        states: plan.dependencies.states.map(s => ({
          stateName: s.stateName,
          setterName: s.setterName,
        })),
        hooks: plan.dependencies.hooks.map(h => h.name),
        imports: plan.dependencies.imports.map(i => ({
          name: i.name,
          source: i.source,
        })),
      },
      propTypes: plan.propTypes.map(pt => ({
        name: pt.name,
        type: this.typeStringifier.toString(pt.typeAnnotation),
        optional: pt.optional,
      })),
      componentName: plan.componentName,
      targetFile: plan.targetFile,
      isSameFile: plan.isSameFile,
    };

    return ok(analysis);
  }

  /**
   * Initialize extraction process: validate inputs, parse files, and create plan
   *
   * @param files - Array of file inputs
   * @param selector - Selector or RangeSelector to select JSX nodes
   * @param options - Extract options
   * @returns Result with initialization data or error
   */
  private initialize(
    files: FileInput[],
    selector: Selector | RangeSelector,
    options: ExtractOptions
  ): Result<{ astMap: Map<string, t.File>; plan: ExtractPlan }, RegraffError> {
    // Step 1: Input validation
    const validationResult = this.inputValidator.validate(files, selector, options);
    if (!validationResult.ok) {
      return validationResult;
    }

    // Step 2: File parsing
    const astMapResult = this.parseFiles(files);
    if (!astMapResult.ok) {
      return astMapResult;
    }

    // Step 3: Extract planning
    const planResult = this.extractPlanner.plan(
      files,
      astMapResult.value,
      selector,
      options
    );
    if (!planResult.ok) {
      return planResult;
    }

    return ok({ astMap: astMapResult.value, plan: planResult.value });
  }

  /**
   * Parse all files into AST map
   *
   * @param files - Array of file inputs
   * @returns Map of file paths to ASTs or error
   */
  private parseFiles(files: FileInput[]): Result<Map<string, t.File>, RegraffError> {
    const astMap = new Map<string, t.File>();

    for (const file of files) {
      const parseResult = parseFile(file.path, file.content);
      if (!parseResult.ok) {
        return err(
          createExtractError(ExtractErrorCode.FILE_READ_FAILED, {
            file: file.path,
            details: `Failed to parse file: ${parseResult.error.message}`,
          })
        );
      }
      astMap.set(file.path, parseResult.value);
    }

    return ok(astMap);
  }

}
