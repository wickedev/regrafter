/**
 * Tests for ImportDependencyAnalyzer
 */

import { describe, it, expect } from "vitest";
import { parse } from "@babel/parser";
import traverse, { type NodePath, type Binding } from "@babel/traverse";
import * as t from "@babel/types";

import { createImportDependencyAnalyzer } from "../import-dependency-analyzer.js";
import type { IdentifierReference } from "../../types.js";
import { DependencyType } from "../../types.js";

/**
 * Helper to parse code and get identifier references
 */
function parseAndCollectIdentifiers(code: string): {
  identifiers: IdentifierReference[];
  findBinding: (path: NodePath, name: string) => Binding | null;
} {
  const ast = parse(code, {
    sourceType: "module",
    plugins: ["jsx", "typescript"],
  });

  const identifiers: IdentifierReference[] = [];
  let scopeBinding: ((path: NodePath, name: string) => Binding | null) | null = null;

  traverse(ast, {
    JSXElement(path) {
      // Collect identifiers in JSX, including JSX element names
      path.traverse({
        JSXIdentifier(jsxIdPath) {
          // Only collect JSX opening element names (component references)
          const parent = jsxIdPath.parent;
          if (
            t.isJSXOpeningElement(parent) &&
            parent.name === jsxIdPath.node &&
            // Skip lowercase elements (HTML tags)
            jsxIdPath.node.name[0] === jsxIdPath.node.name[0].toUpperCase()
          ) {
            // Convert JSXIdentifier path to a regular identifier for binding lookup
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
          // Skip property keys and JSX tag names
          if (
            (t.isObjectProperty(parent) && parent.key === idPath.node && !parent.computed) ||
            (t.isMemberExpression(parent) && parent.property === idPath.node && !parent.computed)
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
  };
}

describe("ImportDependencyAnalyzer", () => {
  describe("detectImportDependencies", () => {
    it("should detect named imports", () => {
      const code = `
        import { Button } from './Button';
        function App() {
          return <div><Button /></div>;
        }
      `;

      const { identifiers, findBinding } = parseAndCollectIdentifiers(code);
      const analyzer = createImportDependencyAnalyzer(true, findBinding);
      const deps = analyzer.detectImportDependencies(identifiers);

      expect(deps).toHaveLength(1);
      expect(deps[0]).toMatchObject({
        localName: "Button",
        importedName: "Button",
        source: "./Button",
        importType: "named",
        type: DependencyType.Import,
      });
    });

    it("should detect default imports", () => {
      const code = `
        import React from 'react';
        function App() {
          return <div>{React.version}</div>;
        }
      `;

      const { identifiers, findBinding } = parseAndCollectIdentifiers(code);
      const analyzer = createImportDependencyAnalyzer(true, findBinding);
      const deps = analyzer.detectImportDependencies(identifiers);

      expect(deps).toHaveLength(1);
      expect(deps[0]).toMatchObject({
        localName: "React",
        importedName: "default",
        source: "react",
        importType: "default",
        type: DependencyType.Import,
      });
    });

    it("should detect namespace imports", () => {
      const code = `
        import * as Utils from './utils';
        function App() {
          return <div>{Utils.format()}</div>;
        }
      `;

      const { identifiers, findBinding } = parseAndCollectIdentifiers(code);
      const analyzer = createImportDependencyAnalyzer(true, findBinding);
      const deps = analyzer.detectImportDependencies(identifiers);

      expect(deps).toHaveLength(1);
      expect(deps[0]).toMatchObject({
        localName: "Utils",
        importedName: "*",
        source: "./utils",
        importType: "namespace",
        type: DependencyType.Import,
      });
    });

    it("should detect multiple imports", () => {
      const code = `
        import React from 'react';
        import { Button, Input } from './components';
        function App() {
          return <div><Button /><Input />{React.version}</div>;
        }
      `;

      const { identifiers, findBinding } = parseAndCollectIdentifiers(code);
      const analyzer = createImportDependencyAnalyzer(true, findBinding);
      const deps = analyzer.detectImportDependencies(identifiers);

      expect(deps).toHaveLength(3);
      const names = deps.map(d => d.localName).sort();
      expect(names).toEqual(["Button", "Input", "React"]);
    });

    it("should deduplicate import references", () => {
      const code = `
        import { Button } from './Button';
        function App() {
          return <div><Button /><Button /><Button /></div>;
        }
      `;

      const { identifiers, findBinding } = parseAndCollectIdentifiers(code);
      const analyzer = createImportDependencyAnalyzer(true, findBinding);
      const deps = analyzer.detectImportDependencies(identifiers);

      expect(deps).toHaveLength(1);
      expect(deps[0].localName).toBe("Button");
    });

    it("should return empty array when includeImports is false", () => {
      const code = `
        import { Button } from './Button';
        function App() {
          return <div><Button /></div>;
        }
      `;

      const { identifiers, findBinding } = parseAndCollectIdentifiers(code);
      const analyzer = createImportDependencyAnalyzer(false, findBinding);
      const deps = analyzer.detectImportDependencies(identifiers);

      expect(deps).toHaveLength(0);
    });

    it("should skip identifiers without bindings", () => {
      const code = `
        function App() {
          return <div>{undefined}</div>;
        }
      `;

      const { identifiers, findBinding } = parseAndCollectIdentifiers(code);
      const analyzer = createImportDependencyAnalyzer(true, findBinding);
      const deps = analyzer.detectImportDependencies(identifiers);

      expect(deps).toHaveLength(0);
    });

    it("should skip non-import bindings", () => {
      const code = `
        function App() {
          const Button = () => <button />;
          return <div><Button /></div>;
        }
      `;

      const { identifiers, findBinding } = parseAndCollectIdentifiers(code);
      const analyzer = createImportDependencyAnalyzer(true, findBinding);
      const deps = analyzer.detectImportDependencies(identifiers);

      expect(deps).toHaveLength(0);
    });

    it("should handle renamed imports", () => {
      const code = `
        import { Button as MyButton } from './Button';
        function App() {
          return <div><MyButton /></div>;
        }
      `;

      const { identifiers, findBinding } = parseAndCollectIdentifiers(code);
      const analyzer = createImportDependencyAnalyzer(true, findBinding);
      const deps = analyzer.detectImportDependencies(identifiers);

      expect(deps).toHaveLength(1);
      expect(deps[0]).toMatchObject({
        localName: "MyButton",
        importedName: "Button",
        source: "./Button",
        importType: "named",
      });
    });

    it("should handle mixed import types", () => {
      const code = `
        import React, { useState, useEffect } from 'react';
        import * as Utils from './utils';
        function App() {
          const [state, setState] = useState();
          return <div>{React.version}{Utils.format()}</div>;
        }
      `;

      const { identifiers, findBinding } = parseAndCollectIdentifiers(code);
      const analyzer = createImportDependencyAnalyzer(true, findBinding);
      const deps = analyzer.detectImportDependencies(identifiers);

      expect(deps.length).toBeGreaterThan(0);
      const types = new Set(deps.map(d => d.importType));
      expect(types.size).toBeGreaterThan(1); // Multiple import types
    });
  });

  describe("isImportBinding", () => {
    it("should return true for import specifier", () => {
      const code = `import { Button } from './Button';`;
      const ast = parse(code, { sourceType: "module" });

      traverse(ast, {
        ImportSpecifier(path) {
          const binding = path.scope.getBinding("Button");
          if (binding) {
            const analyzer = createImportDependencyAnalyzer(true, () => null);
            expect(analyzer.isImportBinding(binding)).toBe(true);
          }
        },
      });
    });

    it("should return true for default import", () => {
      const code = `import React from 'react';`;
      const ast = parse(code, { sourceType: "module" });

      traverse(ast, {
        ImportDefaultSpecifier(path) {
          const binding = path.scope.getBinding("React");
          if (binding) {
            const analyzer = createImportDependencyAnalyzer(true, () => null);
            expect(analyzer.isImportBinding(binding)).toBe(true);
          }
        },
      });
    });

    it("should return true for namespace import", () => {
      const code = `import * as Utils from './utils';`;
      const ast = parse(code, { sourceType: "module" });

      traverse(ast, {
        ImportNamespaceSpecifier(path) {
          const binding = path.scope.getBinding("Utils");
          if (binding) {
            const analyzer = createImportDependencyAnalyzer(true, () => null);
            expect(analyzer.isImportBinding(binding)).toBe(true);
          }
        },
      });
    });

    it("should return false for variable binding", () => {
      const code = `const Button = () => <button />;`;
      const ast = parse(code, {
        sourceType: "module",
        plugins: ["jsx"],
      });

      traverse(ast, {
        VariableDeclarator(path) {
          if (t.isIdentifier(path.node.id)) {
            const binding = path.scope.getBinding(path.node.id.name);
            if (binding) {
              const analyzer = createImportDependencyAnalyzer(true, () => null);
              expect(analyzer.isImportBinding(binding)).toBe(false);
            }
          }
        },
      });
    });
  });

  describe("getImportInfo", () => {
    it("should extract info from named import", () => {
      const code = `import { Button } from './Button';`;
      const ast = parse(code, { sourceType: "module" });

      traverse(ast, {
        ImportSpecifier(path) {
          const binding = path.scope.getBinding("Button");
          if (binding) {
            const analyzer = createImportDependencyAnalyzer(true, () => null);
            const info = analyzer.getImportInfo(binding);

            expect(info).toEqual({
              localName: "Button",
              importedName: "Button",
              source: "./Button",
              type: "named",
            });
          }
        },
      });
    });

    it("should extract info from default import", () => {
      const code = `import React from 'react';`;
      const ast = parse(code, { sourceType: "module" });

      traverse(ast, {
        ImportDefaultSpecifier(path) {
          const binding = path.scope.getBinding("React");
          if (binding) {
            const analyzer = createImportDependencyAnalyzer(true, () => null);
            const info = analyzer.getImportInfo(binding);

            expect(info).toEqual({
              localName: "React",
              importedName: "default",
              source: "react",
              type: "default",
            });
          }
        },
      });
    });

    it("should extract info from namespace import", () => {
      const code = `import * as Utils from './utils';`;
      const ast = parse(code, { sourceType: "module" });

      traverse(ast, {
        ImportNamespaceSpecifier(path) {
          const binding = path.scope.getBinding("Utils");
          if (binding) {
            const analyzer = createImportDependencyAnalyzer(true, () => null);
            const info = analyzer.getImportInfo(binding);

            expect(info).toEqual({
              localName: "Utils",
              importedName: "*",
              source: "./utils",
              type: "namespace",
            });
          }
        },
      });
    });

    it("should handle renamed imports", () => {
      const code = `import { Button as MyButton } from './Button';`;
      const ast = parse(code, { sourceType: "module" });

      traverse(ast, {
        ImportSpecifier(path) {
          const binding = path.scope.getBinding("MyButton");
          if (binding) {
            const analyzer = createImportDependencyAnalyzer(true, () => null);
            const info = analyzer.getImportInfo(binding);

            expect(info).toEqual({
              localName: "MyButton",
              importedName: "Button",
              source: "./Button",
              type: "named",
            });
          }
        },
      });
    });

    it("should return null for non-import binding", () => {
      const code = `const Button = () => <button />;`;
      const ast = parse(code, {
        sourceType: "module",
        plugins: ["jsx"],
      });

      traverse(ast, {
        VariableDeclarator(path) {
          if (t.isIdentifier(path.node.id)) {
            const binding = path.scope.getBinding(path.node.id.name);
            if (binding) {
              const analyzer = createImportDependencyAnalyzer(true, () => null);
              const info = analyzer.getImportInfo(binding);

              expect(info).toBeNull();
            }
          }
        },
      });
    });

    it("should handle string literal import names", () => {
      const code = `import { "default" as MyDefault } from './module';`;
      const ast = parse(code, { sourceType: "module" });

      traverse(ast, {
        ImportSpecifier(path) {
          const binding = path.scope.getBinding("MyDefault");
          if (binding) {
            const analyzer = createImportDependencyAnalyzer(true, () => null);
            const info = analyzer.getImportInfo(binding);

            expect(info).toEqual({
              localName: "MyDefault",
              importedName: "default",
              source: "./module",
              type: "named",
            });
          }
        },
      });
    });
  });

  describe("edge cases", () => {
    it("should handle empty identifier list", () => {
      const analyzer = createImportDependencyAnalyzer(true, () => null);
      const deps = analyzer.detectImportDependencies([]);

      expect(deps).toHaveLength(0);
    });

    it("should handle identifiers with null bindings", () => {
      const code = `
        function App() {
          return <div>{Button}</div>;
        }
      `;

      const { identifiers } = parseAndCollectIdentifiers(code);
      const analyzer = createImportDependencyAnalyzer(true, () => null);
      const deps = analyzer.detectImportDependencies(identifiers);

      expect(deps).toHaveLength(0);
    });

    it("should handle side-effect imports", () => {
      const code = `
        import './styles.css';
        function App() {
          return <div>Hello</div>;
        }
      `;

      const { identifiers, findBinding } = parseAndCollectIdentifiers(code);
      const analyzer = createImportDependencyAnalyzer(true, findBinding);
      const deps = analyzer.detectImportDependencies(identifiers);

      // Side-effect imports don't create bindings
      expect(deps).toHaveLength(0);
    });
  });
});
