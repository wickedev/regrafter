/**
 * ExtractDependencyAnalyzer
 *
 * Task 4.2: Variable dependency implementation
 * Task 4.4: Function dependency implementation
 *
 * Analyzes dependencies of selected JSX nodes for extract operation
 */

import type { NodePath } from '@babel/traverse';
import traverseModule from '@babel/traverse';
import * as t from '@babel/types';

import { IdentifierCollector } from '../core/index.js';
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
 * Analyzes dependencies of selected JSX nodes to generate list of items to pass as Props
 */
export class ExtractDependencyAnalyzer {
  private readonly scopeManager: ScopeManager;

  constructor(scopeManager: ScopeManager) {
    this.scopeManager = scopeManager;
  }

  /**
   * Analyze dependencies of selected nodes
   *
   * @param nodes - Array of selected JSX node paths
   * @param sourceScope - Source component scope information
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

    // Collect import information from AST root
    const importMap = this.collectImports(nodes[0]);

    // Traverse all nodes to collect Identifiers
    for (const nodePath of nodes) {
      this.collectIdentifiers(nodePath, identifierNames);
    }

    // Check scope of each identifier
    for (const name of identifierNames) {
      const dependency = this.analyzeDependency(name, nodes[0], sourceScope, importMap);
      if (dependency) {
        if (dependency.type === 'variable') {
          variables.push(dependency.data);
        } else if (dependency.type === 'function') {
          functions.push(dependency.data);
        } else if (dependency.type === 'state') {
          // Handle state dependencies separately
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

    // Check circular dependency
    const circularDependencyResult = this.detectCircularDependency(dependencies, nodes);
    if (!circularDependencyResult.ok) {
      return circularDependencyResult;
    }

    return ok(dependencies);
  }

  /**
   * Traverse AST node to collect all Identifiers
   * Uses shared IdentifierCollector to eliminate code duplication
   */
  private collectIdentifiers(nodePath: NodePath, identifiers: Set<string>): void {
    const collector = new IdentifierCollector({ includeJSXElements: true });
    const names = collector.collectNames(nodePath);

    // Add collected names to the provided set
    names.forEach(name => identifiers.add(name));
  }

  /**
   * Collect import information from AST root
   */
  private collectImports(contextPath: NodePath): Map<string, { source: string; isDefault: boolean }> {
    const importMap = new Map<string, { source: string; isDefault: boolean }>();

    // Access entire AST through contextPath
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
   * Analyze dependency of individual identifier
   */
  private analyzeDependency(
    name: string,
    contextPath: NodePath,
    sourceScope: ScopeInfo,
    importMap: Map<string, { source: string; isDefault: boolean }>
  ): { type: 'variable' | 'function' | 'state' | 'import'; data: VariableDependency | FunctionDependency | StateDependency | ImportDependency } | null {
    // Check if it's an imported identifier first
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
      // If no binding, it might be a global variable or React component
      // Currently ignored
      return null;
    }

    // Exclude declarations in current node's scope
    const declarationPath = binding.path;
    if (this.isWithinNodes(declarationPath, contextPath)) {
      return null;
    }

    // Check if it's a useState call
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

    // Check if it's a function or variable
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
   * Check if declaration is within selected nodes
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
   * Check if binding is a function
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
   * Check if CallExpression is a Hook call
   */
  private isHookCall(node: t.CallExpression): boolean {
    if (t.isIdentifier(node.callee)) {
      const name = node.callee.name;
      // Hooks like useCallback, useMemo
      return name.startsWith('use') && name.length > 3;
    }
    return false;
  }

  /**
   * Check if declaration is useState call and return state info
   */
  private getStateInfo(declarationPath: NodePath): { stateName: string; setterName: string } | null {
    const node = declarationPath.node;

    // Check if VariableDeclarator
    if (!t.isVariableDeclarator(node)) {
      return null;
    }

    // Check if init is CallExpression and useState call
    const init = node.init;
    if (!t.isCallExpression(init)) {
      return null;
    }

    // Check if callee is 'useState'
    if (!t.isIdentifier(init.callee) || init.callee.name !== 'useState') {
      return null;
    }

    // Check if id is ArrayPattern (const [state, setState] = ...)
    const id = node.id;
    if (!t.isArrayPattern(id)) {
      return null;
    }

    // Extract state variable and setter names from array pattern
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
   * Check circular dependency
   * Task 19.2: Circular dependency detection implementation
   */
  private detectCircularDependency(
    dependencies: ExtractDependencies,
    extractNodes: NodePath[]
  ): Result<void, any> {
    // Collect identifiers declared in extract region
    const declaredInExtractRegion = this.collectDeclaredIdentifiers(extractNodes);

    // Check if each dependency references identifiers in extract region
    const allDependencies = [
      ...dependencies.variables,
      ...dependencies.functions,
    ];

    for (const dep of allDependencies) {
      const referencedIdentifiers = this.collectReferencedIdentifiers(dep.declaration);

      // If dependency references identifier declared in extract region, circular dependency
      for (const refName of referencedIdentifiers) {
        if (declaredInExtractRegion.has(refName)) {
          return err(
            createExtractError(ExtractErrorCode.CIRCULAR_DEPENDENCY, {
              details: `Dependency '${dep.name}' references variable '${refName}' in extract region`,
            })
          );
        }
      }
    }

    return ok(undefined);
  }

  /**
   * Collect all identifiers declared in extract region
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
   * Collect all identifiers referenced by dependency declaration
   */
  private collectReferencedIdentifiers(declarationPath: NodePath): Set<string> {
    const referenced = new Set<string>();
    const node = declarationPath.node;

    traverse(
      node,
      {
        Identifier(path) {
          // Collect only references, not declarations
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
