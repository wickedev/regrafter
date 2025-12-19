/**
 * Tests for VariableDependencyAnalyzer
 */

import { describe, it, expect } from "vitest";
import { parse } from "@babel/parser";
import * as t from "@babel/types";
import traverseFn, { type NodePath, type Binding } from "@babel/traverse";

const traverse = traverseFn as any as typeof traverseFn.default;

import { createScopeManager } from "../../../scope/index.js";
import { createVariableDependencyAnalyzer } from "../variable-dependency-analyzer.js";
import { DependencyType } from "../../types.js";
import type { ScopeInfo } from "../../../types/internal.js";

describe("VariableDependencyAnalyzer", () => {
  function setup(code: string) {
    const ast = parse(code, {
      sourceType: "module",
      plugins: ["jsx", "typescript"],
    });

    const scopeManager = createScopeManager();
    scopeManager.buildScopeTree(ast);

    const analyzer = createVariableDependencyAnalyzer();

    // Mock helper functions
    const isFromHook = () => false;
    const isImportBinding = (binding: Binding) =>
      t.isImportSpecifier(binding.path.node) ||
      t.isImportDefaultSpecifier(binding.path.node) ||
      t.isImportNamespaceSpecifier(binding.path.node);
    const isParameterBinding = (binding: Binding) => binding.kind === "param";

    return { analyzer, ast, scopeManager, isFromHook, isImportBinding, isParameterBinding };
  }

  function collectIdentifiers(code: string) {
    const { ast } = setup(code);
    const identifiers: Array<{ name: string; path: NodePath<t.Identifier>; usage: 'value' | 'call' | 'jsx-element' | 'jsx-attribute' | 'spread'; scope: ScopeInfo | null }> = [];

    // Find JSX element first
    let foundPath: NodePath | null = null;
    traverse(ast, {
      JSXElement(path: NodePath) {
        if (!foundPath) foundPath = path;
      },
    });

    if (!foundPath) return [];

    // Type assertion: foundPath is guaranteed to be non-null here
    const jsxPath = foundPath as NodePath;

    // Only collect identifiers within JSX element
    jsxPath.traverse({
      Identifier(path: NodePath<t.Identifier>) {
        const parent = path.parent;
        if (
          (t.isObjectProperty(parent) && parent.key === path.node && !parent.computed) ||
          (t.isMemberExpression(parent) && parent.property === path.node && !parent.computed) ||
          (t.isVariableDeclarator(parent) && parent.id === path.node) ||
          (t.isFunctionDeclaration(parent) && parent.id === path.node)
        ) {
          return;
        }
        identifiers.push({ name: path.node.name, path, usage: "value", scope: null });
      },
    });

    return identifiers;
  }

  it("should detect const variable dependencies", () => {
    const code = `
      function Component() {
        const value = 10;
        return <div>{value}</div>;
      }
    `;
    const { analyzer, isFromHook, isImportBinding, isParameterBinding } = setup(code);
    const identifiers = collectIdentifiers(code);

    const result = analyzer.detectVariableDependencies(
      identifiers,
      null,
      isFromHook,
      isImportBinding,
      isParameterBinding
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe("value");
    expect(result[0]?.type).toBe(DependencyType.Variable);
    expect(result[0]?.isConst).toBe(true);
  });

  it("should detect let variable dependencies", () => {
    const code = `
      function Component() {
        let count = 0;
        return <div>{count}</div>;
      }
    `;
    const { analyzer, isFromHook, isImportBinding, isParameterBinding } = setup(code);
    const identifiers = collectIdentifiers(code);

    const result = analyzer.detectVariableDependencies(
      identifiers,
      null,
      isFromHook,
      isImportBinding,
      isParameterBinding
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe("count");
    expect(result[0]?.isConst).toBe(false);
  });

  it("should detect function declaration dependencies", () => {
    const code = `
      function Component() {
        function helper() {}
        return <div>{helper()}</div>;
      }
    `;
    const { analyzer, isFromHook, isImportBinding, isParameterBinding } = setup(code);
    const identifiers = collectIdentifiers(code);

    const result = analyzer.detectVariableDependencies(
      identifiers,
      null,
      isFromHook,
      isImportBinding,
      isParameterBinding
    );

    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe("helper");
    expect(result[0]?.isConst).toBe(true); // Functions are effectively const
  });

  it("should skip hook bindings", () => {
    const code = `
      function Component() {
        const [state] = useState(0);
        return <div>{state}</div>;
      }
    `;
    const { analyzer, isImportBinding, isParameterBinding } = setup(code);
    const identifiers = collectIdentifiers(code);
    const isFromHook = () => true; // Mock: all bindings are from hooks

    const result = analyzer.detectVariableDependencies(
      identifiers,
      null,
      isFromHook,
      isImportBinding,
      isParameterBinding
    );

    expect(result).toHaveLength(0);
  });

  it("should skip import bindings", () => {
    const code = `
      import React from 'react';

      function Component() {
        return <div>{React.version}</div>;
      }
    `;
    const { analyzer, isFromHook, isImportBinding, isParameterBinding } = setup(code);
    const identifiers = collectIdentifiers(code);

    const result = analyzer.detectVariableDependencies(
      identifiers,
      null,
      isFromHook,
      isImportBinding,
      isParameterBinding
    );

    expect(result).toHaveLength(0);
  });

  it("should skip parameter bindings", () => {
    const code = `
      function Component({ value }) {
        return <div>{value}</div>;
      }
    `;
    const { analyzer, isFromHook, isImportBinding, isParameterBinding } = setup(code);
    const identifiers = collectIdentifiers(code);

    const result = analyzer.detectVariableDependencies(
      identifiers,
      null,
      isFromHook,
      isImportBinding,
      isParameterBinding
    );

    expect(result).toHaveLength(0);
  });

  it("should deduplicate by name", () => {
    const code = `
      function Component() {
        const value = 10;
        return <div>{value}{value}</div>;
      }
    `;
    const { analyzer, isFromHook, isImportBinding, isParameterBinding } = setup(code);
    const identifiers = collectIdentifiers(code);

    const result = analyzer.detectVariableDependencies(
      identifiers,
      null,
      isFromHook,
      isImportBinding,
      isParameterBinding
    );

    expect(result).toHaveLength(1);
  });
});
