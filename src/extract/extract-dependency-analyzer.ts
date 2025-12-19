/**
 * ExtractDependencyAnalyzer
 *
 * Task 4.2: 변수 의존성 구현
 * Task 4.4: 함수 의존성 구현
 *
 * Analyzes dependencies of selected JSX nodes for extract operation
 */

import type { NodePath } from '@babel/traverse';
import traverseModule from '@babel/traverse';
import * as t from '@babel/types';

import { ScopeManager, type ScopeInfo } from '../scope/index.js';
import { loadTraverseFunction, type TraverseFunction } from '../utils/index.js';
import { ok, err, type Result } from '../result/index.js';
import { createExtractError, ExtractErrorCode } from './errors.js';

import type {
  ExtractDependencies,
  VariableDependency,
  FunctionDependency,
  StateDependency,
  ImportDependency,
} from './types.js';

const traverse: TraverseFunction = loadTraverseFunction(traverseModule);

/**
 * ExtractDependencyAnalyzer
 *
 * 선택된 JSX 노드들의 의존성을 분석하여 Props로 전달해야 할 목록을 생성
 */
export class ExtractDependencyAnalyzer {
  private readonly scopeManager: ScopeManager;

  constructor(scopeManager: ScopeManager) {
    this.scopeManager = scopeManager;
  }

  /**
   * 선택된 노드들의 의존성 분석
   *
   * @param nodes - 선택된 JSX 노드 경로 배열
   * @param sourceScope - 소스 컴포넌트의 스코프 정보
   * @returns Result<ExtractDependencies, RegraffError>
   */
  analyze(
    nodes: NodePath[],
    sourceScope: ScopeInfo
  ): Result<ExtractDependencies, any> {
    const variables: VariableDependency[] = [];
    const functions: FunctionDependency[] = [];
    const states: StateDependency[] = [];
    const imports: ImportDependency[] = [];
    const identifierNames = new Set<string>();

    // AST 루트에서 import 정보 수집
    const importMap = this.collectImports(nodes[0]);

    // 모든 노드 순회하여 Identifier 수집
    for (const nodePath of nodes) {
      this.collectIdentifiers(nodePath, identifierNames);
    }

    // 각 identifier의 스코프 확인
    for (const name of identifierNames) {
      const dependency = this.analyzeDependency(name, nodes[0], sourceScope, importMap);
      if (dependency) {
        if (dependency.type === 'variable') {
          variables.push(dependency.data);
        } else if (dependency.type === 'function') {
          functions.push(dependency.data);
        } else if (dependency.type === 'state') {
          // state 의존성은 별도로 처리
          const existingState = states.find(
            s => s.stateName === dependency.data.stateName || s.setterName === dependency.data.setterName
          );
          if (!existingState) {
            states.push(dependency.data);
          }
        } else if (dependency.type === 'import') {
          imports.push(dependency.data);
        }
      }
    }

    const dependencies: ExtractDependencies = {
      variables,
      functions,
      states,
      hooks: [],
      imports,
    };

    // 순환 의존성 검사
    const circularDependencyResult = this.detectCircularDependency(dependencies, nodes);
    if (!circularDependencyResult.ok) {
      return circularDependencyResult;
    }

    return ok(dependencies);
  }

  /**
   * AST 노드를 순회하여 모든 Identifier를 수집
   */
  private collectIdentifiers(nodePath: NodePath, identifiers: Set<string>): void {
    const node = nodePath.node;

    traverse(
      node,
      {
        Identifier(path) {
          // JSX 속성 이름은 제외
          if (t.isJSXAttribute(path.parent) && path.parent.name === path.node) {
            return;
          }
          // 객체 프로퍼티 키는 제외 (computed가 아닌 경우)
          if (
            t.isObjectProperty(path.parent) &&
            path.parent.key === path.node &&
            !path.parent.computed
          ) {
            return;
          }

          identifiers.add(path.node.name);
        },
        JSXIdentifier(path) {
          // JSX 엘리먼트 이름만 수집 (속성 이름 제외)
          if (t.isJSXOpeningElement(path.parent) || t.isJSXClosingElement(path.parent)) {
            identifiers.add(path.node.name);
          }
        },
      },
      nodePath.scope
    );
  }

  /**
   * AST 루트에서 import 정보 수집
   */
  private collectImports(contextPath: NodePath): Map<string, { source: string; isDefault: boolean }> {
    const importMap = new Map<string, { source: string; isDefault: boolean }>();

    // contextPath.hub.file을 통해 전체 AST에 접근
    const programPath = contextPath.scope.getProgramParent().path;
    const program = programPath.node;

    if (t.isProgram(program)) {
      for (const statement of program.body) {
        if (t.isImportDeclaration(statement)) {
          const source = statement.source.value;

          for (const specifier of statement.specifiers) {
            if (t.isImportDefaultSpecifier(specifier)) {
              // default import: import Foo from 'foo'
              importMap.set(specifier.local.name, { source, isDefault: true });
            } else if (t.isImportSpecifier(specifier)) {
              // named import: import { Foo } from 'foo'
              importMap.set(specifier.local.name, { source, isDefault: false });
            } else if (t.isImportNamespaceSpecifier(specifier)) {
              // namespace import: import * as Foo from 'foo'
              importMap.set(specifier.local.name, { source, isDefault: false });
            }
          }
        }
      }
    }

    return importMap;
  }

  /**
   * 개별 identifier의 의존성 분석
   */
  private analyzeDependency(
    name: string,
    contextPath: NodePath,
    sourceScope: ScopeInfo,
    importMap: Map<string, { source: string; isDefault: boolean }>
  ): { type: 'variable' | 'function' | 'state' | 'import'; data: VariableDependency | FunctionDependency | StateDependency | ImportDependency } | null {
    // import된 식별자인지 먼저 확인
    const importInfo = importMap.get(name);
    if (importInfo) {
      const importDep: ImportDependency = {
        name,
        source: importInfo.source,
        isDefault: importInfo.isDefault,
      };
      return { type: 'import', data: importDep };
    }

    const binding = contextPath.scope.getBinding(name);
    if (!binding) {
      // 바인딩이 없으면 전역 변수이거나 React 컴포넌트일 수 있음
      // 현재는 무시
      return null;
    }

    // 현재 노드의 스코프에서 선언된 것은 제외
    const declarationPath = binding.path;
    if (this.isWithinNodes(declarationPath, contextPath)) {
      return null;
    }

    // useState 호출인지 확인
    const stateInfo = this.getStateInfo(declarationPath);
    if (stateInfo) {
      const type = this.extractTypeFromDeclaration(declarationPath);
      const stateDep: StateDependency = {
        stateName: stateInfo.stateName,
        setterName: stateInfo.setterName,
        declaration: declarationPath,
        type,
      };
      return { type: 'state', data: stateDep };
    }

    // 함수인지 변수인지 확인
    if (this.isFunctionBinding(binding)) {
      const type = this.extractTypeFromDeclaration(declarationPath);
      const functionDep: FunctionDependency = {
        name,
        declaration: declarationPath,
        type,
      };
      return { type: 'function', data: functionDep };
    } else {
      const type = this.extractTypeFromDeclaration(declarationPath);
      const variableDep: VariableDependency = {
        name,
        declaration: declarationPath,
        type,
      };
      return { type: 'variable', data: variableDep };
    }
  }

  /**
   * Extract TypeScript type annotation from a declaration
   */
  private extractTypeFromDeclaration(declarationPath: NodePath): t.TSType | undefined {
    const node = declarationPath.node;

    let typeAnnotation: t.TSType | undefined;

    // VariableDeclarator: const foo: string = ...
    if (t.isVariableDeclarator(node)) {
      // Check if the id has a type annotation
      if (t.isIdentifier(node.id) && node.id.typeAnnotation) {
        if (t.isTSTypeAnnotation(node.id.typeAnnotation)) {
          typeAnnotation = node.id.typeAnnotation.typeAnnotation;
        }
      }
      // Check if the id is an ArrayPattern (const [a, b]: [number, number] = ...)
      if (t.isArrayPattern(node.id) && node.id.typeAnnotation) {
        if (t.isTSTypeAnnotation(node.id.typeAnnotation)) {
          typeAnnotation = node.id.typeAnnotation.typeAnnotation;
        }
      }
    }

    // FunctionDeclaration: function foo(): string { ... }
    if (t.isFunctionDeclaration(node) && node.returnType) {
      if (t.isTSTypeAnnotation(node.returnType)) {
        typeAnnotation = node.returnType.typeAnnotation;
      }
    }

    // Resolve type aliases
    if (typeAnnotation) {
      return this.resolveTypeAlias(typeAnnotation, declarationPath);
    }

    return undefined;
  }

  /**
   * Resolve type alias to actual type
   * If the type is a reference to a type alias, resolve it to the actual type definition
   */
  private resolveTypeAlias(typeAnnotation: t.TSType, contextPath: NodePath): t.TSType {
    // Only resolve TSTypeReferences (e.g., Status, User)
    if (!t.isTSTypeReference(typeAnnotation)) {
      return typeAnnotation;
    }

    // Get the type name
    if (!t.isIdentifier(typeAnnotation.typeName)) {
      return typeAnnotation;
    }

    const typeName = typeAnnotation.typeName.name;

    // Get the program node to search for type alias declarations
    // Add safety checks to prevent errors
    if (!contextPath.scope) {
      return typeAnnotation;
    }

    const programParent = contextPath.scope.getProgramParent();
    if (!programParent || !programParent.path) {
      return typeAnnotation;
    }

    const program = programParent.path.node;

    if (!t.isProgram(program)) {
      return typeAnnotation;
    }

    // Search for type alias declaration
    for (const statement of program.body) {
      if (t.isTSTypeAliasDeclaration(statement)) {
        if (t.isIdentifier(statement.id) && statement.id.name === typeName) {
          // Found the type alias! Return the actual type
          return statement.typeAnnotation;
        }
      }
    }

    // If not found, return the original type reference (e.g., User interface)
    return typeAnnotation;
  }

  /**
   * 선언이 선택된 노드 내부에 있는지 확인
   */
  private isWithinNodes(declarationPath: NodePath, contextPath: NodePath): boolean {
    let current: NodePath | null = declarationPath;
    while (current) {
      if (current === contextPath) {
        return true;
      }
      current = current.parentPath;
    }
    return false;
  }

  /**
   * 바인딩이 함수인지 확인
   */
  private isFunctionBinding(binding: any): boolean {
    const path = binding.path;
    const node = path.node;

    // FunctionDeclaration
    if (t.isFunctionDeclaration(node)) {
      return true;
    }

    // VariableDeclarator with function expression
    if (t.isVariableDeclarator(node)) {
      const init = node.init;
      return (
        t.isFunctionExpression(init) ||
        t.isArrowFunctionExpression(init) ||
        (t.isCallExpression(init) && this.isHookCall(init))
      );
    }

    return false;
  }

  /**
   * CallExpression이 Hook 호출인지 확인
   */
  private isHookCall(node: t.CallExpression): boolean {
    if (t.isIdentifier(node.callee)) {
      const name = node.callee.name;
      // useCallback, useMemo 같은 Hook들
      return name.startsWith('use') && name.length > 3;
    }
    return false;
  }

  /**
   * 선언이 useState 호출인지 확인하고 상태 정보 반환
   */
  private getStateInfo(declarationPath: NodePath): { stateName: string; setterName: string } | null {
    const node = declarationPath.node;

    // VariableDeclarator인지 확인
    if (!t.isVariableDeclarator(node)) {
      return null;
    }

    // init이 CallExpression이고 useState 호출인지 확인
    const init = node.init;
    if (!t.isCallExpression(init)) {
      return null;
    }

    // callee가 'useState'인지 확인
    if (!t.isIdentifier(init.callee) || init.callee.name !== 'useState') {
      return null;
    }

    // id가 ArrayPattern인지 확인 (const [state, setState] = ...)
    const id = node.id;
    if (!t.isArrayPattern(id)) {
      return null;
    }

    // 배열 패턴에서 상태 변수와 setter 이름 추출
    const elements = id.elements;
    if (elements.length < 2) {
      return null;
    }

    const stateElement = elements[0];
    const setterElement = elements[1];

    if (!t.isIdentifier(stateElement) || !t.isIdentifier(setterElement)) {
      return null;
    }

    return {
      stateName: stateElement.name,
      setterName: setterElement.name,
    };
  }

  /**
   * 순환 의존성 검사
   * Task 19.2: 순환 의존성 감지 구현
   */
  private detectCircularDependency(
    dependencies: ExtractDependencies,
    extractNodes: NodePath[]
  ): Result<void, any> {
    // 추출 영역 내에서 선언된 식별자들을 수집
    const declaredInExtractRegion = this.collectDeclaredIdentifiers(extractNodes);

    // 각 의존성이 추출 영역 내의 식별자를 참조하는지 검사
    const allDependencies = [
      ...dependencies.variables,
      ...dependencies.functions,
    ];

    for (const dep of allDependencies) {
      const referencedIdentifiers = this.collectReferencedIdentifiers(dep.declaration);

      // 의존성이 추출 영역 내에서 선언된 식별자를 참조하면 순환 의존성
      for (const refName of referencedIdentifiers) {
        if (declaredInExtractRegion.has(refName)) {
          return err(
            createExtractError(ExtractErrorCode.CIRCULAR_DEPENDENCY, {
              details: `의존성 '${dep.name}'이(가) 추출 영역 내의 변수 '${refName}'을(를) 참조합니다`,
            })
          );
        }
      }
    }

    return ok(undefined);
  }

  /**
   * 추출 영역 내에서 선언된 모든 식별자 수집
   */
  private collectDeclaredIdentifiers(nodes: NodePath[]): Set<string> {
    const declared = new Set<string>();

    for (const nodePath of nodes) {
      const node = nodePath.node;

      traverse(
        node,
        {
          VariableDeclarator(path) {
            if (t.isIdentifier(path.node.id)) {
              declared.add(path.node.id.name);
            } else if (t.isArrayPattern(path.node.id)) {
              // const [a, b] = ...
              for (const elem of path.node.id.elements) {
                if (elem && t.isIdentifier(elem)) {
                  declared.add(elem.name);
                }
              }
            } else if (t.isObjectPattern(path.node.id)) {
              // const { a, b } = ...
              for (const prop of path.node.id.properties) {
                if (t.isObjectProperty(prop) && t.isIdentifier(prop.value)) {
                  declared.add(prop.value.name);
                }
              }
            }
          },
          FunctionDeclaration(path) {
            if (path.node.id && t.isIdentifier(path.node.id)) {
              declared.add(path.node.id.name);
            }
          },
        },
        nodePath.scope
      );
    }

    return declared;
  }

  /**
   * 의존성 선언부가 참조하는 모든 식별자 수집
   */
  private collectReferencedIdentifiers(declarationPath: NodePath): Set<string> {
    const referenced = new Set<string>();
    const node = declarationPath.node;

    traverse(
      node,
      {
        Identifier(path) {
          // 선언이 아닌 참조만 수집
          if (path.isReferencedIdentifier()) {
            referenced.add(path.node.name);
          }
        },
      },
      declarationPath.scope
    );

    return referenced;
  }
}
