/**
 * Tests for IdentifierCollector
 */

import { describe, it, expect } from "vitest";
import { parse } from "@babel/parser";
import traverseFn, { type NodePath } from "@babel/traverse";

const traverse = traverseFn as any as typeof traverseFn.default;

import { createScopeManager } from "../../../scope/index.js";
import { createIdentifierCollector } from "../identifier-collector.js";

describe("IdentifierCollector", () => {
  function setup(code: string) {
    const ast = parse(code, {
      sourceType: "module",
      plugins: ["jsx", "typescript"],
    });

    const scopeManager = createScopeManager();
    scopeManager.buildScopeTree(ast);

    const collector = createIdentifierCollector(scopeManager);

    // Helper to find JSX element
    let elementPath: NodePath | null = null;
    traverse(ast, {
      JSXElement(path) {
        if (!elementPath) elementPath = path;
      },
    });

    return { collector, elementPath, ast, scopeManager };
  }

  describe("collectIdentifiers", () => {
    it("should collect simple identifier references", () => {
      const code = `
        function Component() {
          const name = "test";
          return <div>{name}</div>;
        }
      `;
      const { collector, elementPath } = setup(code);

      if (!elementPath) throw new Error("No JSX element found");

      const result = collector.collectIdentifiers(elementPath);

      expect(result.identifiers).toHaveLength(1);
      expect(result.identifiers[0]?.name).toBe("name");
      expect(result.identifiers[0]?.usage).toBe("value");
    });

    it("should collect multiple identifier references", () => {
      const code = `
        function Component() {
          const firstName = "John";
          const lastName = "Doe";
          return <div>{firstName} {lastName}</div>;
        }
      `;
      const { collector, elementPath } = setup(code);

      if (!elementPath) throw new Error("No JSX element found");

      const result = collector.collectIdentifiers(elementPath);

      expect(result.identifiers).toHaveLength(2);
      const names = result.identifiers.map((id) => id.name);
      expect(names).toContain("firstName");
      expect(names).toContain("lastName");
    });

    it("should collect JSX component names", () => {
      const code = `
        function Component() {
          return <CustomComponent />;
        }
      `;
      const { collector, elementPath } = setup(code);

      if (!elementPath) throw new Error("No JSX element found");

      const result = collector.collectIdentifiers(elementPath);

      expect(result.jsxElementNames).toContain("CustomComponent");
      expect(result.identifiers.some((id) => id.name === "CustomComponent")).toBe(true);
    });

    it("should not collect built-in HTML element names", () => {
      const code = `
        function Component() {
          return <div><span>test</span></div>;
        }
      `;
      const { collector, elementPath } = setup(code);

      if (!elementPath) throw new Error("No JSX element found");

      const result = collector.collectIdentifiers(elementPath);

      expect(result.jsxElementNames).not.toContain("div");
      expect(result.jsxElementNames).not.toContain("span");
    });

    it("should collect compound component names", () => {
      const code = `
        function Component() {
          return <Tabs.Panel />;
        }
      `;
      const { collector, elementPath } = setup(code);

      if (!elementPath) throw new Error("No JSX element found");

      const result = collector.collectIdentifiers(elementPath);

      expect(result.jsxElementNames).toContain("Tabs.Panel");
      expect(result.identifiers.some((id) => id.name === "Tabs")).toBe(true);
    });

    it("should collect spread attributes", () => {
      const code = `
        function Component() {
          const props = { a: 1 };
          return <div {...props} />;
        }
      `;
      const { collector, elementPath } = setup(code);

      if (!elementPath) throw new Error("No JSX element found");

      const result = collector.collectIdentifiers(elementPath);

      expect(result.spreads).toHaveLength(1);
      expect(result.identifiers.some((id) => id.name === "props")).toBe(true);
      const propsId = result.identifiers.find((id) => id.name === "props");
      expect(propsId?.usage).toBe("spread");
    });

    it("should collect member expression roots", () => {
      const code = `
        function Component() {
          const user = { name: "test" };
          return <div>{user.name}</div>;
        }
      `;
      const { collector, elementPath } = setup(code);

      if (!elementPath) throw new Error("No JSX element found");

      const result = collector.collectIdentifiers(elementPath);

      expect(result.identifiers.some((id) => id.name === "user")).toBe(true);
    });

    it("should collect nested member expression roots", () => {
      const code = `
        function Component() {
          const data = { user: { profile: { name: "test" } } };
          return <div>{data.user.profile.name}</div>;
        }
      `;
      const { collector, elementPath } = setup(code);

      if (!elementPath) throw new Error("No JSX element found");

      const result = collector.collectIdentifiers(elementPath);

      expect(result.identifiers.some((id) => id.name === "data")).toBe(true);
    });

    it("should collect function call identifiers", () => {
      const code = `
        function Component() {
          const formatName = (s: string) => s;
          const name = "test";
          return <div>{formatName(name)}</div>;
        }
      `;
      const { collector, elementPath } = setup(code);

      if (!elementPath) throw new Error("No JSX element found");

      const result = collector.collectIdentifiers(elementPath);

      const names = result.identifiers.map((id) => id.name);
      expect(names).toContain("formatName");
      expect(names).toContain("name");

      const formatNameId = result.identifiers.find((id) => id.name === "formatName");
      expect(formatNameId?.usage).toBe("call");
    });

    it("should collect method call identifiers", () => {
      const code = `
        function Component() {
          const utils = { format: (s: string) => s };
          return <div>{utils.format("test")}</div>;
        }
      `;
      const { collector, elementPath } = setup(code);

      if (!elementPath) throw new Error("No JSX element found");

      const result = collector.collectIdentifiers(elementPath);

      expect(result.identifiers.some((id) => id.name === "utils")).toBe(true);
    });

    it("should skip property keys", () => {
      const code = `
        function Component() {
          const obj = { name: "test" };
          return <div>{obj.name}</div>;
        }
      `;
      const { collector, elementPath } = setup(code);

      if (!elementPath) throw new Error("No JSX element found");

      const result = collector.collectIdentifiers(elementPath);

      // Should only collect "obj", not "name" (the property key)
      const identifierNames = result.identifiers.map((id) => id.name);
      expect(identifierNames).toContain("obj");
      // "name" should not appear as an identifier (it's a property key)
      const nameCount = identifierNames.filter((n) => n === "name").length;
      expect(nameCount).toBe(0);
    });

    it("should skip declaration identifiers", () => {
      const code = `
        function Component() {
          const name = "test";
          return <div>{name}</div>;
        }
      `;
      const { collector, elementPath } = setup(code);

      if (!elementPath) throw new Error("No JSX element found");

      const result = collector.collectIdentifiers(elementPath);

      // Should collect "name" as a reference, not as a declaration
      const names = result.identifiers.map((id) => id.name);
      expect(names.filter((n) => n === "name")).toHaveLength(1);
    });

    it("should deduplicate identifiers by position", () => {
      const code = `
        function Component() {
          const name = "test";
          return <div>{name}{name}</div>;
        }
      `;
      const { collector, elementPath } = setup(code);

      if (!elementPath) throw new Error("No JSX element found");

      const result = collector.collectIdentifiers(elementPath);

      // Should collect each occurrence separately
      const nameRefs = result.identifiers.filter((id) => id.name === "name");
      expect(nameRefs).toHaveLength(2); // Two different positions
    });

    it("should classify identifier usage correctly", () => {
      const code = `
        function Component() {
          const value = "test";
          const fn = () => {};
          return <div title={value}>{fn()}</div>;
        }
      `;
      const { collector, elementPath } = setup(code);

      if (!elementPath) throw new Error("No JSX element found");

      const result = collector.collectIdentifiers(elementPath);

      const valueId = result.identifiers.find((id) => id.name === "value");
      const fnId = result.identifiers.find((id) => id.name === "fn");

      expect(valueId?.usage).toBe("jsx-attribute");
      expect(fnId?.usage).toBe("call");
    });

    it("should handle empty JSX elements", () => {
      const code = `
        function Component() {
          return <div />;
        }
      `;
      const { collector, elementPath } = setup(code);

      if (!elementPath) throw new Error("No JSX element found");

      const result = collector.collectIdentifiers(elementPath);

      expect(result.identifiers).toHaveLength(0);
      expect(result.jsxElementNames).toHaveLength(0);
      expect(result.spreads).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });

    it("should handle complex nested expressions", () => {
      const code = `
        function Component() {
          const items = [1, 2, 3];
          const multiplier = 2;
          return <div>{items.map(item => item * multiplier)}</div>;
        }
      `;
      const { collector, elementPath } = setup(code);

      if (!elementPath) throw new Error("No JSX element found");

      const result = collector.collectIdentifiers(elementPath);

      const names = result.identifiers.map((id) => id.name);
      expect(names).toContain("items");
      expect(names).toContain("multiplier");
    });

    it("should provide scope information for each identifier", () => {
      const code = `
        function Component() {
          const name = "test";
          return <div>{name}</div>;
        }
      `;
      const { collector, elementPath } = setup(code);

      if (!elementPath) throw new Error("No JSX element found");

      const result = collector.collectIdentifiers(elementPath);

      // Scope may be null if not found
      expect(result.identifiers[0]).toBeDefined();
      // Just verify the structure exists, scope can be null
      expect(result.identifiers[0]).toHaveProperty("scope");
    });

    it("should handle multiple compound components", () => {
      const code = `
        function Component() {
          return (
            <Tabs.Container>
              <Tabs.Panel />
              <Tabs.Tab />
            </Tabs.Container>
          );
        }
      `;
      const { collector, elementPath } = setup(code);

      if (!elementPath) throw new Error("No JSX element found");

      const result = collector.collectIdentifiers(elementPath);

      expect(result.jsxElementNames).toContain("Tabs.Container");
      expect(result.jsxElementNames).toContain("Tabs.Panel");
      expect(result.jsxElementNames).toContain("Tabs.Tab");

      // Should have multiple references to "Tabs"
      const tabsRefs = result.identifiers.filter((id) => id.name === "Tabs");
      expect(tabsRefs.length).toBeGreaterThan(1);
    });
  });
});
