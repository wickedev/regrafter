/**
 * ExtractExecutor
 *
 * Task 9.2, 9.4: ExtractExecutor 구현
 *
 * Requirements:
 * - 3.1: 같은 파일 내 컴포넌트 생성
 * - 3.2: 원본 컴포넌트 정의 앞에 새 컴포넌트 배치
 * - 3.3: 원본 위치의 JSX 코드를 새 컴포넌트 호출로 교체
 * - 2.1: 변수 의존성을 props로 전달
 * - 3.6: Props 전달 코드 생성
 */

import type { NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { ok, err, type Result } from '../result/index.js';
import type { RegraffError } from '../errors/error-category.js';
import { ComponentBuilder } from './component-builder.js';
import { CodeReplacer } from './code-replacer.js';
import { ImportManager } from './import-manager.js';
import type { ExtractPlan, PropType, VariableDependency, FunctionDependency } from './types.js';

/**
 * ExtractExecutor
 *
 * 추출 계획을 실행하여 실제 코드 변환을 수행하는 클래스
 */
export class ExtractExecutor {
  private componentBuilder: ComponentBuilder;
  private codeReplacer: CodeReplacer;
  private importManager: ImportManager;

  constructor() {
    this.componentBuilder = new ComponentBuilder();
    this.codeReplacer = new CodeReplacer();
    this.importManager = new ImportManager();
  }

  /**
   * 추출 계획 실행
   *
   * @param plan - 추출 계획
   * @param asts - 파일별 AST 맵
   * @returns 업데이트된 AST 맵
   */
  execute(
    plan: ExtractPlan,
    asts: Map<string, t.File>
  ): Result<Map<string, t.File>, RegraffError> {
    // 소스 파일 AST 가져오기
    const sourceAst = asts.get(plan.sourceFile);
    if (!sourceAst) {
      return err({
        code: 'FILE_NOT_FOUND',
        message: `Source file not found: ${plan.sourceFile}`,
      });
    }

    // Props 인터페이스 생성 (props가 있는 경우만)
    const propsInterface = this.buildPropsInterface(plan);

    // JSX 본문 추출
    const jsxBody = this.extractJsxBody(plan.selectedNodes);

    // 새 컴포넌트 생성
    const newComponent = this.componentBuilder.buildComponent(
      plan.componentName,
      propsInterface,
      jsxBody,
      plan.hooksToMove
    );

    // 같은 파일 내 추출
    if (plan.isSameFile) {
      this.insertComponentInSameFile(sourceAst, newComponent, propsInterface);
    } else {
      // Task 16.4, 16.6: 다른 파일로 추출
      const targetAst = asts.get(plan.targetFile);

      if (targetAst) {
        // Task 16.6: 기존 파일에 추가
        this.addComponentToExistingFile(targetAst, newComponent, propsInterface);
      } else {
        // Task 16.4: 새 파일 생성
        const newFileAst = this.createNewFile(newComponent, propsInterface, plan);
        asts.set(plan.targetFile, newFileAst);
      }

      // 원본 파일에 import 추가 (Task 16.7)
      this.addImportToSourceFile(sourceAst, plan);
    }

    // 원본 코드를 컴포넌트 호출로 교체 (컴포넌트 삽입 후!)
    // 중요: AST 조작 후에 NodePath를 사용하므로, 컴포넌트 삽입 후에 교체
    const props = this.buildPropsMap(plan);
    this.replaceOriginalCode(plan.selectedNodes, plan.componentName, props);

    // 업데이트된 AST 맵 반환
    const updatedAsts = new Map(asts);
    updatedAsts.set(plan.sourceFile, sourceAst);

    return ok(updatedAsts);
  }

  /**
   * Props 인터페이스 생성
   *
   * @param plan - 추출 계획
   * @returns Props 인터페이스 AST (props가 없으면 null)
   */
  private buildPropsInterface(plan: ExtractPlan): t.TSInterfaceDeclaration | null {
    if (plan.propTypes.length === 0) {
      return null;
    }

    // Props 인터페이스 프로퍼티 생성
    const properties = plan.propTypes.map((propType) => {
      const property = t.tsPropertySignature(
        t.identifier(propType.name),
        t.tsTypeAnnotation(propType.typeAnnotation)
      );
      property.optional = propType.optional;
      return property;
    });

    // Props 인터페이스 생성
    const propsInterface = t.tsInterfaceDeclaration(
      t.identifier(plan.propsInterfaceName),
      null,
      null,
      t.tsInterfaceBody(properties)
    );

    return propsInterface;
  }

  /**
   * JSX 본문 추출
   *
   * @param selectedNodes - 선택된 노드들
   * @returns JSX 본문 노드 배열
   */
  private extractJsxBody(selectedNodes: NodePath[]): t.Node[] {
    return selectedNodes.map((nodePath) => {
      // 노드를 깊은 복사하여 반환
      // cloneNode(deep=true)로 모든 하위 노드까지 복사
      return t.cloneNode(nodePath.node, true, true);
    });
  }

  /**
   * 같은 파일 내에 컴포넌트 삽입
   *
   * @param ast - 소스 파일 AST
   * @param component - 새 컴포넌트 AST
   * @param propsInterface - Props 인터페이스 AST
   */
  private insertComponentInSameFile(
    ast: t.File,
    component: t.FunctionDeclaration,
    propsInterface: t.TSInterfaceDeclaration | null
  ): void {
    // 원본 컴포넌트를 찾아서 그 앞에 삽입
    // 첫 번째 함수 선언 또는 변수 선언을 찾음
    const programBody = ast.program.body;
    let insertIndex = 0;

    for (let i = 0; i < programBody.length; i++) {
      const node = programBody[i];
      if (t.isFunctionDeclaration(node) || t.isVariableDeclaration(node)) {
        insertIndex = i;
        break;
      }
    }

    // Props 인터페이스가 있으면 먼저 삽입
    if (propsInterface) {
      programBody.splice(insertIndex, 0, propsInterface);
      insertIndex++;
    }

    // 컴포넌트 삽입
    programBody.splice(insertIndex, 0, component);
  }

  /**
   * Props 맵 생성
   *
   * @param plan - 추출 계획
   * @returns Props 이름 -> 표현식 맵
   */
  private buildPropsMap(plan: ExtractPlan): Map<string, t.Expression> {
    const props = new Map<string, t.Expression>();

    // 변수 의존성을 props로 추가
    for (const variable of plan.dependencies.variables) {
      props.set(variable.name, t.identifier(variable.name));
    }

    // 함수 의존성을 props로 추가
    for (const func of plan.dependencies.functions) {
      props.set(func.name, t.identifier(func.name));
    }

    // 상태 의존성을 props로 추가 (Task 16.8)
    for (const state of plan.dependencies.states) {
      props.set(state.stateName, t.identifier(state.stateName));
      props.set(state.setterName, t.identifier(state.setterName));
    }

    // Import 의존성을 props로 추가
    for (const importDep of plan.dependencies.imports) {
      props.set(importDep.name, t.identifier(importDep.name));
    }

    return props;
  }

  /**
   * 원본 코드를 컴포넌트 호출로 교체
   *
   * @param selectedNodes - 선택된 노드들
   * @param componentName - 컴포넌트 이름
   * @param props - Props 맵
   */
  private replaceOriginalCode(
    selectedNodes: NodePath[],
    componentName: string,
    props: Map<string, t.Expression>
  ): void {
    // 첫 번째 노드만 컴포넌트 호출로 교체
    // (여러 노드인 경우 나중에 처리)
    if (selectedNodes.length > 0) {
      const firstNode = selectedNodes[0];
      this.codeReplacer.replace(firstNode, componentName, props);

      // 나머지 노드들은 제거
      for (let i = 1; i < selectedNodes.length; i++) {
        selectedNodes[i].remove();
      }
    }
  }

  /**
   * Task 16.4: 새 파일 생성
   *
   * @param component - 컴포넌트 AST
   * @param propsInterface - Props 인터페이스 AST
   * @param plan - 추출 계획
   * @returns 새 파일 AST
   */
  private createNewFile(
    component: t.FunctionDeclaration,
    propsInterface: t.TSInterfaceDeclaration | null,
    plan: ExtractPlan
  ): t.File {
    // 새 파일 AST 생성
    const program = t.program([]);
    const newFileAst = t.file(program, [], []);

    // React import 추가
    this.importManager.ensureReactImport(newFileAst);

    // Props 인터페이스가 있으면 export
    if (propsInterface) {
      // export 키워드 추가
      const exportedInterface = t.exportNamedDeclaration(propsInterface, []);
      program.body.push(exportedInterface);
    }

    // 컴포넌트 export
    const exportedComponent = t.exportNamedDeclaration(component, []);
    program.body.push(exportedComponent);

    return newFileAst;
  }

  /**
   * Task 16.6: 기존 파일에 컴포넌트 추가
   *
   * @param targetAst - 대상 파일 AST
   * @param component - 컴포넌트 AST
   * @param propsInterface - Props 인터페이스 AST
   */
  private addComponentToExistingFile(
    targetAst: t.File,
    component: t.FunctionDeclaration,
    propsInterface: t.TSInterfaceDeclaration | null
  ): void {
    const program = targetAst.program;

    // React import 확인 (중복 방지)
    this.importManager.ensureReactImport(targetAst);

    // Props 인터페이스가 있으면 export
    if (propsInterface) {
      const exportedInterface = t.exportNamedDeclaration(propsInterface, []);
      program.body.push(exportedInterface);
    }

    // 컴포넌트 export
    const exportedComponent = t.exportNamedDeclaration(component, []);
    program.body.push(exportedComponent);
  }

  /**
   * Task 16.7: 원본 파일에 import 추가
   *
   * @param sourceAst - 원본 파일 AST
   * @param plan - 추출 계획
   */
  private addImportToSourceFile(sourceAst: t.File, plan: ExtractPlan): void {
    // 상대 경로 계산
    const relativePath = this.importManager.resolveRelativePath(
      plan.sourceFile,
      plan.targetFile
    );

    // 컴포넌트 import 추가
    this.importManager.addImport(
      sourceAst,
      plan.componentName,
      relativePath,
      false
    );
  }
}
