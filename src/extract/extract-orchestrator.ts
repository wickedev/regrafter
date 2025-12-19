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

import type { FileInput, Selector } from '../types/public.js';
import type {
  ExtractOptions,
  ExtractResult,
  ExtractAnalysis,
  RangeSelector,
} from './types.js';
import type { Result } from '../result/types.js';
import type { RegraffError } from '../errors/error-category.js';
import * as t from '@babel/types';
import { ok, err } from '../result/types.js';
import { InputValidator } from './input-validator.js';
import { ExtractPlanner } from './extract-planner.js';
import { ExtractExecutor } from './extract-executor.js';
import { CodeFormatter } from './CodeFormatter.js';
import { parseFile } from '../parser/index.js';
import { createExtractError, ExtractErrorCode } from './errors.js';

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
  private inputValidator: InputValidator;
  private extractPlanner: ExtractPlanner;
  private extractExecutor: ExtractExecutor;
  private codeFormatter: CodeFormatter;

  constructor() {
    this.inputValidator = new InputValidator();
    this.extractPlanner = new ExtractPlanner();
    this.extractExecutor = new ExtractExecutor();
    this.codeFormatter = new CodeFormatter();
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
    // Step 1: Input validation
    const validationResult = this.inputValidator.validate(
      files,
      selector,
      options
    );

    if (!validationResult.ok) {
      return validationResult;
    }

    // Step 2: File parsing
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

    // Step 3: Extract planning
    const planResult = this.extractPlanner.plan(files, astMap, selector, options);
    if (!planResult.ok) {
      return planResult;
    }

    const plan = planResult.value;

    // Step 4: Plan execution
    const executeResult = this.extractExecutor.execute(plan, astMap);
    if (!executeResult.ok) {
      return executeResult;
    }

    const updatedAsts = executeResult.value;

    // Step 5: Code formatting
    const codes: Array<{ path: string; content: string }> = [];

    for (const [filePath, ast] of updatedAsts) {
      const originalFile = files.find(f => f.path === filePath);
      const originalContent = originalFile?.content ?? '';

      const formatResult = this.codeFormatter.format(ast, originalContent);
      if (!formatResult.ok) {
        return formatResult;
      }

      codes.push({
        path: filePath,
        content: formatResult.value,
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
          type: this.typeToString(pt.typeAnnotation),
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
    // Step 1: Input validation
    const validationResult = this.inputValidator.validate(
      files,
      selector,
      {}
    );

    if (!validationResult.ok) {
      return false;
    }

    // Step 2: File parsing
    const astMap = new Map<string, t.File>();
    for (const file of files) {
      const parseResult = parseFile(file.path, file.content);
      if (!parseResult.ok) {
        return false;
      }
      astMap.set(file.path, parseResult.value);
    }

    // Step 3: Extract planning
    const planResult = this.extractPlanner.plan(files, astMap, selector, {});
    if (!planResult.ok) {
      return false;
    }

    // If planning succeeds, extraction is possible
    return true;
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
    // Step 1: Input validation
    const validationResult = this.inputValidator.validate(
      files,
      selector,
      {}
    );

    if (!validationResult.ok) {
      return validationResult;
    }

    // Step 2: File parsing
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

    // Step 3: Extract planning
    const planResult = this.extractPlanner.plan(files, astMap, selector, {});
    if (!planResult.ok) {
      return planResult;
    }

    const plan = planResult.value;

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
        type: this.typeToString(pt.typeAnnotation),
        optional: pt.optional,
      })),
      componentName: plan.componentName,
      targetFile: plan.targetFile,
      isSameFile: plan.isSameFile,
    };

    return ok(analysis);
  }

  /**
   * Convert TypeScript type AST to string
   *
   * @param typeAnnotation - Type AST
   * @returns Type string
   */
  private typeToString(typeAnnotation: t.TSType): string {
    // Primitive types
    if (t.isTSAnyKeyword(typeAnnotation)) {
      return 'any';
    }
    if (t.isTSStringKeyword(typeAnnotation)) {
      return 'string';
    }
    if (t.isTSNumberKeyword(typeAnnotation)) {
      return 'number';
    }
    if (t.isTSBooleanKeyword(typeAnnotation)) {
      return 'boolean';
    }
    if (t.isTSVoidKeyword(typeAnnotation)) {
      return 'void';
    }
    if (t.isTSUndefinedKeyword(typeAnnotation)) {
      return 'undefined';
    }
    if (t.isTSNullKeyword(typeAnnotation)) {
      return 'null';
    }

    // Type references (e.g., User, React.ReactNode)
    if (t.isTSTypeReference(typeAnnotation)) {
      if (t.isIdentifier(typeAnnotation.typeName)) {
        return typeAnnotation.typeName.name;
      }
      if (t.isTSQualifiedName(typeAnnotation.typeName)) {
        return this.qualifiedNameToString(typeAnnotation.typeName);
      }
    }

    // Union types (e.g., 'active' | 'inactive')
    if (t.isTSUnionType(typeAnnotation)) {
      return typeAnnotation.types.map(t => this.typeToString(t)).join(' | ');
    }

    // Array types (e.g., string[])
    if (t.isTSArrayType(typeAnnotation)) {
      return `${this.typeToString(typeAnnotation.elementType)}[]`;
    }

    // Literal types (e.g., 'active', 42, true)
    if (t.isTSLiteralType(typeAnnotation)) {
      const literal = typeAnnotation.literal;
      if (t.isStringLiteral(literal)) {
        return `'${literal.value}'`;
      }
      if (t.isNumericLiteral(literal)) {
        return String(literal.value);
      }
      if (t.isBooleanLiteral(literal)) {
        return String(literal.value);
      }
    }

    // Function types (e.g., (x: number) => string)
    if (t.isTSFunctionType(typeAnnotation)) {
      const params = typeAnnotation.parameters.map(p => {
        if (t.isIdentifier(p) && p.typeAnnotation && t.isTSTypeAnnotation(p.typeAnnotation)) {
          return `${p.name}: ${this.typeToString(p.typeAnnotation.typeAnnotation)}`;
        }
        return 'any';
      }).join(', ');
      const returnType = typeAnnotation.typeAnnotation
        ? this.typeToString(typeAnnotation.typeAnnotation.typeAnnotation)
        : 'void';
      return `(${params}) => ${returnType}`;
    }

    // Default fallback
    return 'any';
  }

  /**
   * Convert a TSQualifiedName to string (e.g., React.ReactNode)
   */
  private qualifiedNameToString(name: t.TSQualifiedName): string {
    const left = t.isIdentifier(name.left)
      ? name.left.name
      : this.qualifiedNameToString(name.left as t.TSQualifiedName);
    const right = name.right.name;
    return `${left}.${right}`;
  }

}
