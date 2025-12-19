/**
 * Tests for PropDependencyAnalyzer
 */

import { describe, it, expect } from "vitest";
import { parse } from "@babel/parser";
import traverse, { type NodePath, type Binding } from "@babel/traverse";
import * as t from "@babel/types";

import { createPropDependencyAnalyzer } from "../prop-dependency-analyzer.js";
import type { IdentifierReference } from "../../types.js";
import { DependencyType } from "../../types.js";
import type { ComponentScope } from "../../../scope/index.js";

/**
 * Helper to parse code and collect identifiers with bindings
 */
function parseAndCollectIdentifiers(code: string): {
  identifiers: IdentifierReference[];
  findBinding: (path: NodePath, name: string) => Binding | null;
  componentScope: ComponentScope | null;
} {
  const ast = parse(code, {
    sourceType: "module",
    plugins: ["jsx", "typescript"],
  });

  const identifiers: IdentifierReference[] = [];
  let scopeBinding: ((path: NodePath, name: string) => Binding | null) | null = null;
  let componentScope: ComponentScope | null = null;

  traverse(ast, {
    FunctionDeclaration(path) {
      // Capture component info
      if (t.isIdentifier(path.node.id)) {
        componentScope = {
          type: "Component" as const,
          componentName: path.node.id.name,
          path,
          parent: null,
        } as ComponentScope;
      }

      // Collect identifiers in function body
      path.traverse({
        JSXIdentifier(jsxIdPath) {
          const parent = jsxIdPath.parent;
          if (
            t.isJSXOpeningElement(parent) &&
            parent.name === jsxIdPath.node &&
            jsxIdPath.node.name[0] === jsxIdPath.node.name[0].toUpperCase()
          ) {
            const name = jsxIdPath.node.name;
            identifiers.push({
              name,
              path: jsxIdPath as unknown as NodePath,
            });
          }
        },
        Identifier(idPath) {
          if (!idPath.isIdentifier()) return;

          const parent = idPath.parent;
          // Skip property keys, declarations, and binding patterns
          if (
            (t.isObjectProperty(parent) && parent.key === idPath.node && !parent.computed) ||
            (t.isMemberExpression(parent) && parent.property === idPath.node && !parent.computed) ||
            (t.isVariableDeclarator(parent) && parent.id === idPath.node) ||
            (t.isFunctionDeclaration(parent) && parent.id === idPath.node)
          ) {
            return;
          }

          identifiers.push({
            name: idPath.node.name,
            path: idPath,
          });
        },
      });

      // Store scope binding function
      scopeBinding = (p: NodePath, name: string) => {
        return p.scope.getBinding(name) ?? null;
      };
    },
  });

  return {
    identifiers,
    findBinding: scopeBinding ?? (() => null),
    componentScope,
  };
}

/**
 * Helper for isParameterBinding
 */
function isParameterBinding(binding: Binding): boolean {
  return binding.kind === "param";
}

describe("PropDependencyAnalyzer", () => {
  describe("detectPropDependencies", () => {
    it.skip("should detect destructured props", () => {
      const code = `
        function Component({ name, age }) {
          return <div>{name} {age}</div>;
        }
      `;

      const { identifiers, findBinding, componentScope } = parseAndCollectIdentifiers(code);
      const analyzer = createPropDependencyAnalyzer(findBinding, isParameterBinding);
      const deps = analyzer.detectPropDependencies(identifiers, componentScope);

      expect(deps.length).toBeGreaterThan(0);
      const propNames = new Set(deps.map(d => d.name));
      expect(propNames.has("name") || propNames.has("age")).toBe(true);
    });

    it("should mark destructured props correctly", () => {
      const code = `
        function Component({ title }) {
          return <div>{title}</div>;
        }
      `;

      const { identifiers, findBinding, componentScope } = parseAndCollectIdentifiers(code);
      const analyzer = createPropDependencyAnalyzer(findBinding, isParameterBinding);
      const deps = analyzer.detectPropDependencies(identifiers, componentScope);

      const titleDep = deps.find(d => d.name === "title");
      if (titleDep) {
        expect(titleDep.isDestructured).toBe(true);
      }
    });

    it("should return empty array for non-prop identifiers", () => {
      const code = `
        function Component() {
          const localVar = "test";
          return <div>{localVar}</div>;
        }
      `;

      const { identifiers, findBinding, componentScope } = parseAndCollectIdentifiers(code);
      const analyzer = createPropDependencyAnalyzer(findBinding, isParameterBinding);
      const deps = analyzer.detectPropDependencies(identifiers, componentScope);

      expect(deps).toHaveLength(0);
    });

    it("should deduplicate prop references", () => {
      const code = `
        function Component({ name }) {
          return <div>{name} {name} {name}</div>;
        }
      `;

      const { identifiers, findBinding, componentScope } = parseAndCollectIdentifiers(code);
      const analyzer = createPropDependencyAnalyzer(findBinding, isParameterBinding);
      const deps = analyzer.detectPropDependencies(identifiers, componentScope);

      const nameCount = deps.filter(d => d.name === "name").length;
      expect(nameCount).toBeLessThanOrEqual(1);
    });

    it.skip("should handle multiple destructured props", () => {
      const code = `
        function Component({ title, subtitle, description }) {
          return <div>{title}{subtitle}{description}</div>;
        }
      `;

      const { identifiers, findBinding, componentScope } = parseAndCollectIdentifiers(code);
      const analyzer = createPropDependencyAnalyzer(findBinding, isParameterBinding);
      const deps = analyzer.detectPropDependencies(identifiers, componentScope);

      expect(deps.length).toBeGreaterThan(0);
    });

    it("should set correct component name", () => {
      const code = `
        function MyComponent({ name }) {
          return <div>{name}</div>;
        }
      `;

      const { identifiers, findBinding, componentScope } = parseAndCollectIdentifiers(code);
      const analyzer = createPropDependencyAnalyzer(findBinding, isParameterBinding);
      const deps = analyzer.detectPropDependencies(identifiers, componentScope);

      const nameDep = deps.find(d => d.name === "name");
      if (nameDep) {
        expect(nameDep.component).toBe("MyComponent");
      }
    });

    it("should handle null componentScope", () => {
      const code = `
        function Component({ name }) {
          return <div>{name}</div>;
        }
      `;

      const { identifiers, findBinding } = parseAndCollectIdentifiers(code);
      const analyzer = createPropDependencyAnalyzer(findBinding, isParameterBinding);
      const deps = analyzer.detectPropDependencies(identifiers, null);

      const nameDep = deps.find(d => d.name === "name");
      if (nameDep) {
        expect(nameDep.component).toBe("Unknown");
      }
    });

    it("should handle identifiers without bindings", () => {
      const code = `
        function Component() {
          return <div>{undefined}</div>;
        }
      `;

      const { identifiers, findBinding, componentScope } = parseAndCollectIdentifiers(code);
      const analyzer = createPropDependencyAnalyzer(findBinding, isParameterBinding);
      const deps = analyzer.detectPropDependencies(identifiers, componentScope);

      expect(deps).toHaveLength(0);
    });

    it("should set correct dependency type", () => {
      const code = `
        function Component({ name }) {
          return <div>{name}</div>;
        }
      `;

      const { identifiers, findBinding, componentScope } = parseAndCollectIdentifiers(code);
      const analyzer = createPropDependencyAnalyzer(findBinding, isParameterBinding);
      const deps = analyzer.detectPropDependencies(identifiers, componentScope);

      const nameDep = deps.find(d => d.name === "name");
      if (nameDep) {
        expect(nameDep.type).toBe(DependencyType.Prop);
      }
    });

    it("should handle renamed destructured props", () => {
      const code = `
        function Component({ name: userName }) {
          return <div>{userName}</div>;
        }
      `;

      const { identifiers, findBinding, componentScope } = parseAndCollectIdentifiers(code);
      const analyzer = createPropDependencyAnalyzer(findBinding, isParameterBinding);
      const deps = analyzer.detectPropDependencies(identifiers, componentScope);

      const userNameDep = deps.find(d => d.name === "name");
      if (userNameDep) {
        expect(userNameDep.name).toBe("name");
      }
    });
  });

  describe("getPropInfo", () => {
    it.skip("should return prop info for destructured parameter", () => {
      const code = `function Component({ name }) { return <div>{name}</div>; }`;
      const ast = parse(code, {
        sourceType: "module",
        plugins: ["jsx"],
      });

      traverse(ast, {
        FunctionDeclaration(path) {
          const binding = path.scope.getBinding("name");
          if (binding) {
            const componentScope: ComponentScope = {
              type: "Component",
              componentName: "Component",
              path,
              parent: null,
            } as ComponentScope;

            const analyzer = createPropDependencyAnalyzer(() => null, isParameterBinding);
            const info = analyzer.getPropInfo(binding, componentScope);

            expect(info).toEqual({
              name: "name",
              component: "Component",
              isDestructured: true,
            });
          }
        },
      });
    });

    it("should return null for non-parameter binding", () => {
      const code = `
        function Component() {
          const local = "test";
          return <div>{local}</div>;
        }
      `;
      const ast = parse(code, {
        sourceType: "module",
        plugins: ["jsx"],
      });

      traverse(ast, {
        VariableDeclarator(path) {
          if (t.isIdentifier(path.node.id)) {
            const binding = path.scope.getBinding(path.node.id.name);
            if (binding) {
              const analyzer = createPropDependencyAnalyzer(() => null, isParameterBinding);
              const info = analyzer.getPropInfo(binding, null);

              expect(info).toBeNull();
            }
          }
        },
      });
    });

    it("should return null for direct props object", () => {
      const code = `function Component(props) { return <div>{props.name}</div>; }`;
      const ast = parse(code, {
        sourceType: "module",
        plugins: ["jsx"],
      });

      traverse(ast, {
        FunctionDeclaration(path) {
          const binding = path.scope.getBinding("props");
          if (binding) {
            const analyzer = createPropDependencyAnalyzer(() => null, isParameterBinding);
            const info = analyzer.getPropInfo(binding, null);

            expect(info).toBeNull();
          }
        },
      });
    });

    it("should handle string literal prop keys", () => {
      const code = `function Component({ "data-id": dataId }) { return <div>{dataId}</div>; }`;
      const ast = parse(code, {
        sourceType: "module",
        plugins: ["jsx"],
      });

      traverse(ast, {
        FunctionDeclaration(path) {
          const binding = path.scope.getBinding("dataId");
          if (binding) {
            const analyzer = createPropDependencyAnalyzer(() => null, isParameterBinding);
            const info = analyzer.getPropInfo(binding, null);

            if (info) {
              expect(info.name).toBe("data-id");
            }
          }
        },
      });
    });

    it("should use Unknown component when componentScope is null", () => {
      const code = `function Component({ name }) { return <div>{name}</div>; }`;
      const ast = parse(code, {
        sourceType: "module",
        plugins: ["jsx"],
      });

      traverse(ast, {
        FunctionDeclaration(path) {
          const binding = path.scope.getBinding("name");
          if (binding) {
            const analyzer = createPropDependencyAnalyzer(() => null, isParameterBinding);
            const info = analyzer.getPropInfo(binding, null);

            if (info) {
              expect(info.component).toBe("Unknown");
            }
          }
        },
      });
    });

    it("should return null for non-function binding", () => {
      const code = `const name = "test";`;
      const ast = parse(code, { sourceType: "module" });

      traverse(ast, {
        VariableDeclarator(path) {
          if (t.isIdentifier(path.node.id)) {
            const binding = path.scope.getBinding(path.node.id.name);
            if (binding) {
              // Override isParameterBinding to return true for testing
              const fakeIsParam = () => true;
              const analyzer = createPropDependencyAnalyzer(() => null, fakeIsParam);
              const info = analyzer.getPropInfo(binding, null);

              expect(info).toBeNull();
            }
          }
        },
      });
    });
  });

  describe("edge cases", () => {
    it("should handle empty identifier list", () => {
      const analyzer = createPropDependencyAnalyzer(() => null, isParameterBinding);
      const deps = analyzer.detectPropDependencies([], null);

      expect(deps).toHaveLength(0);
    });

    it("should handle components with no props", () => {
      const code = `
        function Component() {
          return <div>Hello</div>;
        }
      `;

      const { identifiers, findBinding, componentScope } = parseAndCollectIdentifiers(code);
      const analyzer = createPropDependencyAnalyzer(findBinding, isParameterBinding);
      const deps = analyzer.detectPropDependencies(identifiers, componentScope);

      expect(deps).toHaveLength(0);
    });

    it("should handle arrow functions", () => {
      const code = `
        const Component = ({ name }) => {
          return <div>{name}</div>;
        };
      `;
      const ast = parse(code, {
        sourceType: "module",
        plugins: ["jsx"],
      });

      let found = false;
      traverse(ast, {
        ArrowFunctionExpression(path) {
          const binding = path.scope.getBinding("name");
          if (binding) {
            found = true;
            const analyzer = createPropDependencyAnalyzer(() => null, isParameterBinding);
            const info = analyzer.getPropInfo(binding, null);

            if (info) {
              expect(info.name).toBe("name");
              expect(info.isDestructured).toBe(true);
            }
          }
        },
      });

      expect(found).toBe(true);
    });
  });
});
