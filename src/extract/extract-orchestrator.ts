/**
 * ExtractOrchestrator
 *
 * Task 10.2: ExtractOrchestrator 기본 구현
 *
 * Requirements:
 * - 1.1: JSX 노드 선택 및 추출
 * - 2.1: 의존성 자동 분석
 * - 3.1: 같은 파일 내 컴포넌트 추출
 * - 10.7: 생성된 파일 경로와 변경 사항 요약 반환
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
 * Extract 작업 전체 흐름을 조율하는 클래스
 *
 * Responsibilities:
 * - 입력 검증 (InputValidator)
 * - 파일 파싱
 * - 추출 계획 수립 (ExtractPlanner)
 * - 계획 실행 (ExtractExecutor)
 * - 코드 포맷팅 (CodeFormatter)
 * - 결과 생성 (ExtractResult)
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
   * Extract 작업 전체 흐름 조율
   *
   * @param files - 파일 입력 배열
   * @param selector - JSX 노드를 선택하는 Selector 또는 RangeSelector
   * @param options - 추출 옵션
   * @returns ExtractResult 또는 에러
   *
   * Workflow:
   * 1. 입력 검증
   * 2. 파일 파싱
   * 3. 추출 계획 수립
   * 4. 계획 실행
   * 5. 코드 포맷팅
   * 6. 결과 생성
   */
  orchestrate(
    files: FileInput[],
    selector: Selector | RangeSelector,
    options: ExtractOptions
  ): Result<ExtractResult, RegraffError> {
    // Step 1: 입력 검증
    const validationResult = this.inputValidator.validate(
      files,
      selector,
      options
    );

    if (!validationResult.ok) {
      return validationResult;
    }

    // Step 2: 파일 파싱
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

    // Step 3: 추출 계획 수립
    const planResult = this.extractPlanner.plan(files, astMap, selector, options);
    if (!planResult.ok) {
      return planResult;
    }

    const plan = planResult.value;

    // Step 4: 계획 실행
    const executeResult = this.extractExecutor.execute(plan, astMap);
    if (!executeResult.ok) {
      return executeResult;
    }

    const updatedAsts = executeResult.value;

    // Step 5: 코드 포맷팅
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

    // Step 6: 결과 생성
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
   * 추출 가능 여부만 검증 (dry-run)
   *
   * Task 21.2: canExtract() 함수 구현
   *
   * @param files - 파일 입력 배열
   * @param selector - JSX 노드를 선택하는 Selector 또는 RangeSelector
   * @returns 추출 가능 여부
   *
   * 실제 변환을 수행하지 않고 검증만 수행합니다.
   * 검증 실패 시 false를 반환합니다.
   */
  validate(
    files: FileInput[],
    selector: Selector | RangeSelector
  ): boolean {
    // Step 1: 입력 검증
    const validationResult = this.inputValidator.validate(
      files,
      selector,
      {}
    );

    if (!validationResult.ok) {
      return false;
    }

    // Step 2: 파일 파싱
    const astMap = new Map<string, t.File>();
    for (const file of files) {
      const parseResult = parseFile(file.path, file.content);
      if (!parseResult.ok) {
        return false;
      }
      astMap.set(file.path, parseResult.value);
    }

    // Step 3: 추출 계획 수립
    const planResult = this.extractPlanner.plan(files, astMap, selector, {});
    if (!planResult.ok) {
      return false;
    }

    // 계획 수립까지 성공하면 추출 가능
    return true;
  }

  /**
   * 추출 분석만 수행 (변환 없이)
   *
   * Task 21.4: analyzeExtract() 함수 구현
   *
   * @param files - 파일 입력 배열
   * @param selector - JSX 노드를 선택하는 Selector 또는 RangeSelector
   * @returns ExtractAnalysis 또는 에러
   *
   * 의존성 분석과 계획 수립까지만 수행하고 실제 변환은 수행하지 않습니다.
   *
   * Requirements:
   * - 2.5: 의존성 분석만 수행하고 코드 변환 생략
   */
  analyze(
    files: FileInput[],
    selector: Selector | RangeSelector
  ): Result<ExtractAnalysis, RegraffError> {
    // Step 1: 입력 검증
    const validationResult = this.inputValidator.validate(
      files,
      selector,
      {}
    );

    if (!validationResult.ok) {
      return validationResult;
    }

    // Step 2: 파일 파싱
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

    // Step 3: 추출 계획 수립
    const planResult = this.extractPlanner.plan(files, astMap, selector, {});
    if (!planResult.ok) {
      return planResult;
    }

    const plan = planResult.value;

    // Step 4: 계획을 ExtractAnalysis로 변환
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
   * TypeScript 타입 AST를 문자열로 변환
   *
   * @param typeAnnotation - 타입 AST
   * @returns 타입 문자열
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
