/**
 * ExtractExecutor
 *
 * Task 9.2, 9.4: ExtractExecutor implementation
 *
 * Requirements:
 * - 3.1: Create component within same file
 * - 3.2: Place new component before original component definition
 * - 3.3: Replace JSX code at original location with new component call
 * - 2.1: Pass variable dependencies as props
 * - 3.6: Generate props passing code
 */

import type { NodePath } from '@babel/traverse';
import * as t from '@babel/types';

import { ImportManager } from '../core/index.js';
import type { RegraffError } from '../errors/error-category.js';
import { ok, err, type Result } from '../result/index.js';

import { CodeReplacer } from './code-replacer.js';
import { ComponentBuilder } from './component-builder.js';
import { createExtractError, ExtractErrorCode } from './errors.js';
import type { IExtractExecutor } from './interfaces/i-extract-executor.js';
import type { ExtractPlan } from './types.js';

/**
 * ExtractExecutor
 *
 * Class that executes extraction plan to perform actual code transformation
 */
export class ExtractExecutor implements IExtractExecutor {
  private readonly componentBuilder: ComponentBuilder;
  private readonly codeReplacer: CodeReplacer;
  private readonly importManager: ImportManager;

  constructor() {
    this.componentBuilder = new ComponentBuilder();
    this.codeReplacer = new CodeReplacer();
    this.importManager = new ImportManager();
  }

  /**
   * Execute extraction plan
   *
   * @param plan - Extraction plan
   * @param asts - AST map by file
   * @returns Updated AST map
   */
  execute(
    plan: ExtractPlan,
    asts: Map<string, t.File>
  ): Result<Map<string, t.File>, RegraffError> {
    // Get source file AST
    const sourceAst = asts.get(plan.sourceFile);
    if (!sourceAst) {
      return err(
        createExtractError(ExtractErrorCode.FILE_NOT_FOUND, {
          file: plan.sourceFile,
          details: `Source file not found: ${plan.sourceFile}`,
        })
      );
    }

    // Generate Props interface (only if props exist)
    const propsInterface = this.buildPropsInterface(plan);

    // Extract JSX body
    const jsxBody = this.extractJsxBody(plan.selectedNodes);

    // Create new component
    const newComponent = this.componentBuilder.buildComponent(
      plan.componentName,
      propsInterface,
      jsxBody,
      plan.hooksToMove
    );

    // Extract within same file
    if (plan.isSameFile) {
      this.insertComponentInSameFile(sourceAst, newComponent, propsInterface);
    } else {
      // Task 16.4, 16.6: Extract to different file
      const targetAst = asts.get(plan.targetFile);

      if (targetAst) {
        // Task 16.6: Add to existing file
        this.addComponentToExistingFile(targetAst, newComponent, propsInterface);
      } else {
        // Task 16.4: Create new file
        const newFileAst = this.createNewFile(newComponent, propsInterface, plan);
        asts.set(plan.targetFile, newFileAst);
      }

      // Add import to source file (Task 16.7)
      this.addImportToSourceFile(sourceAst, plan);
    }

    // Replace original code with component call (after component insertion!)
    // Important: Use NodePath after AST manipulation, so replace after component insertion
    const props = this.buildPropsMap(plan);
    this.replaceOriginalCode(sourceAst, plan.selectedNodes, plan.componentName, props);

    // Return updated AST map
    const updatedAsts = new Map(asts);
    updatedAsts.set(plan.sourceFile, sourceAst);

    return ok(updatedAsts);
  }

  /**
   * Generate Props interface
   *
   * @param plan - Extraction plan
   * @returns Props interface AST (null if no props)
   */
  private buildPropsInterface(plan: ExtractPlan): t.TSInterfaceDeclaration | null {
    if (plan.propTypes.length === 0) {
      return null;
    }

    // Generate Props interface properties
    const properties = plan.propTypes.map((propType) => {
      const property = t.tsPropertySignature(
        t.identifier(propType.name),
        t.tsTypeAnnotation(propType.typeAnnotation)
      );
      property.optional = propType.optional;
      return property;
    });

    // Generate Props interface
    const propsInterface = t.tsInterfaceDeclaration(
      t.identifier(plan.propsInterfaceName),
      null,
      null,
      t.tsInterfaceBody(properties)
    );

    return propsInterface;
  }

  /**
   * Extract JSX body
   *
   * @param selectedNodes - Selected nodes
   * @returns JSX body node array
   */
  private extractJsxBody(selectedNodes: NodePath[]): t.Node[] {
    return selectedNodes.map((nodePath) => {
      // Return deep copy of node
      // cloneNode(deep=true) copies all child nodes
      return t.cloneNode(nodePath.node, true, true);
    });
  }

  /**
   * Insert component within same file
   *
   * @param ast - Source file AST
   * @param component - New component AST
   * @param propsInterface - Props interface AST
   */
  private insertComponentInSameFile(
    ast: t.File,
    component: t.FunctionDeclaration,
    propsInterface: t.TSInterfaceDeclaration | null
  ): void {
    // Find original component and insert before it
    // Find first function declaration or variable declaration
    const programBody = ast.program.body;
    let insertIndex = 0;

    for (let i = 0; i < programBody.length; i++) {
      const node = programBody[i];
      if (t.isFunctionDeclaration(node) || t.isVariableDeclaration(node)) {
        insertIndex = i;
        break;
      }
    }

    // Insert Props interface first if it exists
    if (propsInterface) {
      programBody.splice(insertIndex, 0, propsInterface);
      insertIndex++;
    }

    // Insert component
    programBody.splice(insertIndex, 0, component);
  }

  /**
   * Generate Props map
   *
   * @param plan - Extraction plan
   * @returns Props name -> expression map
   */
  private buildPropsMap(plan: ExtractPlan): Map<string, t.Expression> {
    const props = new Map<string, t.Expression>();

    // Add variable dependencies as props
    for (const variable of plan.dependencies.variables) {
      props.set(variable.name, t.identifier(variable.name));
    }

    // Add function dependencies as props
    for (const func of plan.dependencies.functions) {
      props.set(func.name, t.identifier(func.name));
    }

    // Add state dependencies as props (Task 16.8)
    for (const state of plan.dependencies.states) {
      props.set(state.stateName, t.identifier(state.stateName));
      props.set(state.setterName, t.identifier(state.setterName));
    }

    // Add Import dependencies as props
    for (const importDep of plan.dependencies.imports) {
      props.set(importDep.name, t.identifier(importDep.name));
    }

    return props;
  }

  /**
   * Replace original code with component call
   *
   * @param ast - Source file AST
   * @param selectedNodes - Selected nodes
   * @param componentName - Component name
   * @param props - Props map
   */
  private replaceOriginalCode(
    ast: t.File,
    selectedNodes: NodePath[],
    componentName: string,
    props: Map<string, t.Expression>
  ): void {
    // Build replacement JSX element: <ComponentName prop1={value1} prop2={value2} />
    const jsxAttributes = Array.from(props.entries()).map(([name, value]) =>
      t.jsxAttribute(t.jsxIdentifier(name), t.jsxExpressionContainer(value))
    );

    const replacement = t.jsxElement(
      t.jsxOpeningElement(t.jsxIdentifier(componentName), jsxAttributes, true),
      null,
      [],
      true
    );

    // Filter to only JSXElement nodes and replace
    const jsxNodes = selectedNodes.filter(
      (node): node is NodePath<t.JSXElement> => t.isJSXElement(node.node)
    );

    if (jsxNodes.length > 0) {
      this.codeReplacer.replace(ast, jsxNodes, replacement);
    }

    // Remove remaining nodes (non-JSX nodes after the first JSXElement)
    const [, ...remainingNodes] = selectedNodes;
    for (const node of remainingNodes) {
      if (!t.isJSXElement(node.node)) {
        node.remove();
      }
    }
  }

  /**
   * Task 16.4: Create new file
   *
   * @param component - Component AST
   * @param propsInterface - Props interface AST
   * @param plan - Extraction plan
   * @returns New file AST
   */
  private createNewFile(
    component: t.FunctionDeclaration,
    propsInterface: t.TSInterfaceDeclaration | null,
    _plan: ExtractPlan
  ): t.File {
    // Generate new file AST
    const program = t.program([]);
    const newFileAst = t.file(program, [], []);

    // Add React import
    this.importManager.ensureReactImport(newFileAst);

    // Export Props interface if it exists
    if (propsInterface) {
      // Add export keyword
      const exportedInterface = t.exportNamedDeclaration(propsInterface, []);
      program.body.push(exportedInterface);
    }

    // Export component
    const exportedComponent = t.exportNamedDeclaration(component, []);
    program.body.push(exportedComponent);

    return newFileAst;
  }

  /**
   * Task 16.6: Add component to existing file
   *
   * @param targetAst - Target file AST
   * @param component - Component AST
   * @param propsInterface - Props interface AST
   */
  private addComponentToExistingFile(
    targetAst: t.File,
    component: t.FunctionDeclaration,
    propsInterface: t.TSInterfaceDeclaration | null
  ): void {
    const program = targetAst.program;

    // Check React import (prevent duplication)
    this.importManager.ensureReactImport(targetAst);

    // Export Props interface if it exists
    if (propsInterface) {
      const exportedInterface = t.exportNamedDeclaration(propsInterface, []);
      program.body.push(exportedInterface);
    }

    // Export component
    const exportedComponent = t.exportNamedDeclaration(component, []);
    program.body.push(exportedComponent);
  }

  /**
   * Task 16.7: Add import to source file
   *
   * @param sourceAst - Source file AST
   * @param plan - Extraction plan
   */
  private addImportToSourceFile(sourceAst: t.File, plan: ExtractPlan): void {
    // Calculate relative path
    const relativePath = this.importManager.resolveRelativePath(
      plan.sourceFile,
      plan.targetFile
    );

    // Add component import
    this.importManager.addImport(
      sourceAst,
      plan.componentName,
      relativePath,
      false
    );
  }
}
