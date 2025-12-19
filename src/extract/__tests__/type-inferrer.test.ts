/**
 * TypeInferrer Test
 *
 * Task 14.1: TypeInferrer test implementation - Basic types
 * Tests type inference for basic TypeScript types
 */

import { describe, it, expect } from "vitest";
import * as t from "@babel/types";
import { parse } from "@babel/parser";
import traverseModule, { type NodePath } from "@babel/traverse";
import { err, ok, unwrapResult, type Result } from "../../result/index.js";
import { loadTraverseFunction } from "../../utils/index.js";
import { TypeInferrer } from "../type-inferrer.js";
import type {
  FunctionDependency,
  PropType,
  VariableDependency,
} from "../types.js";

const traverse = loadTraverseFunction(traverseModule);

type VariableDeclaratorPath = NodePath<t.VariableDeclarator>;
type FunctionDeclarationPath = NodePath<t.FunctionDeclaration>;

function getTSTypeAnnotation(
  annotation: t.TypeAnnotation | t.TSTypeAnnotation | t.Noop | null | undefined
): t.TSType | undefined {
  if (!annotation) {
    return undefined;
  }
  if (t.isTSTypeAnnotation(annotation)) {
    return annotation.typeAnnotation;
  }
  return undefined;
}

function getFirst<T>(items: T[], label: string): Result<T, string> {
  const [item] = items;
  return item ? ok(item) : err(`Expected ${label}`);
}

function getPropertySignature(
  properties: t.TSTypeElement[],
  index: number
): Result<t.TSPropertySignature, string> {
  const property = properties[index];
  if (!property || !t.isTSPropertySignature(property)) {
    return err(`Expected TSPropertySignature at index ${index}`);
  }
  return ok(property);
}

function requireFirst<T>(items: T[], label: string): T | null {
  return unwrapResult(getFirst(items, label));
}

function requirePropertySignature(
  properties: t.TSTypeElement[],
  index: number
): t.TSPropertySignature | null {
  return unwrapResult(getPropertySignature(properties, index));
}

/**
 * Test helper: Parse TypeScript code to create variable dependency
 */
function createVariableDependency(
  code: string,
  variableName: string
): Result<VariableDependency, string> {
  const ast = parse(code, {
    sourceType: "module",
    plugins: ["typescript", "jsx"],
  });

  let dependency: VariableDependency | null = null;

  traverse(ast, {
    VariableDeclarator(path: VariableDeclaratorPath) {
      const id = path.node.id;
      if (t.isIdentifier(id) && id.name === variableName) {
        dependency = {
          name: variableName,
          declaration: path,
          type: getTSTypeAnnotation(id.typeAnnotation),
        };
      }
    },
  });

  if (!dependency) {
    return err(`Variable ${variableName} not found in code`);
  }

  return ok(dependency);
}

/**
 * Test helper: Parse TypeScript code to create function dependency
 */
function createFunctionDependency(
  code: string,
  functionName: string
): Result<FunctionDependency, string> {
  const ast = parse(code, {
    sourceType: "module",
    plugins: ["typescript", "jsx"],
  });

  let dependency: FunctionDependency | null = null;

  traverse(ast, {
    VariableDeclarator(path: VariableDeclaratorPath) {
      const id = path.node.id;
      if (t.isIdentifier(id) && id.name === functionName) {
        dependency = {
          name: functionName,
          declaration: path,
          type: getTSTypeAnnotation(id.typeAnnotation),
        };
      }
    },
    FunctionDeclaration(path: FunctionDeclarationPath) {
      const id = path.node.id;
      if (id && id.name === functionName) {
        dependency = {
          name: functionName,
          declaration: path,
          type: getTSTypeAnnotation(path.node.returnType),
        };
      }
    },
  });

  if (!dependency) {
    return err(`Function ${functionName} not found in code`);
  }

  return ok(dependency);
}

describe("TypeInferrer", () => {
  describe("inferPropTypes - Basic types", () => {
    it("should infer string type from variable dependency", () => {
      // Arrange
      const inferrer = new TypeInferrer();
      const code = 'const userName: string = "John";';
      const dependencyResult = createVariableDependency(code, "userName");
      const dependency = unwrapResult(dependencyResult);
      if (!dependency) return;

      // Act
      const result = inferrer.inferPropTypes([dependency]);

      // Assert
      expect(result.ok).toBe(true);
      if (result.ok) {
        const propTypes = result.value;
        expect(propTypes).toHaveLength(1);
        const propType = requireFirst(propTypes, "prop type");
        if (!propType) return;
        expect(propType.name).toBe("userName");
        expect(t.isTSStringKeyword(propType.typeAnnotation)).toBe(true);
        expect(propType.optional).toBe(false);
      }
    });

    it("should infer number type from variable dependency", () => {
      // Arrange
      const inferrer = new TypeInferrer();
      const code = "const age: number = 25;";
      const dependencyResult = createVariableDependency(code, "age");
      const dependency = unwrapResult(dependencyResult);
      if (!dependency) return;

      // Act
      const result = inferrer.inferPropTypes([dependency]);

      // Assert
      expect(result.ok).toBe(true);
      if (result.ok) {
        const propTypes = result.value;
        expect(propTypes).toHaveLength(1);
        const propType = requireFirst(propTypes, "prop type");
        if (!propType) return;
        expect(propType.name).toBe("age");
        expect(t.isTSNumberKeyword(propType.typeAnnotation)).toBe(true);
        expect(propType.optional).toBe(false);
      }
    });

    it("should infer boolean type from variable dependency", () => {
      // Arrange
      const inferrer = new TypeInferrer();
      const code = "const isActive: boolean = true;";
      const dependencyResult = createVariableDependency(code, "isActive");
      const dependency = unwrapResult(dependencyResult);
      if (!dependency) return;

      // Act
      const result = inferrer.inferPropTypes([dependency]);

      // Assert
      expect(result.ok).toBe(true);
      if (result.ok) {
        const propTypes = result.value;
        expect(propTypes).toHaveLength(1);
        const propType = requireFirst(propTypes, "prop type");
        if (!propType) return;
        expect(propType.name).toBe("isActive");
        expect(t.isTSBooleanKeyword(propType.typeAnnotation)).toBe(true);
        expect(propType.optional).toBe(false);
      }
    });

    it("should infer multiple prop types from multiple dependencies", () => {
      // Arrange
      const inferrer = new TypeInferrer();
      const nameDepResult = createVariableDependency(
        'const name: string = "Test";',
        "name"
      );
      const countDepResult = createVariableDependency(
        "const count: number = 0;",
        "count"
      );
      const enabledDepResult = createVariableDependency(
        "const enabled: boolean = false;",
        "enabled"
      );
      const nameDep = unwrapResult(nameDepResult);
      const countDep = unwrapResult(countDepResult);
      const enabledDep = unwrapResult(enabledDepResult);
      if (!nameDep || !countDep || !enabledDep) return;

      // Act
      const result = inferrer.inferPropTypes([nameDep, countDep, enabledDep]);

      // Assert
      expect(result.ok).toBe(true);
      if (result.ok) {
        const propTypes = result.value;
        expect(propTypes).toHaveLength(3);

        const nameType = propTypes.find((p) => p.name === "name");
        expect(nameType).toBeDefined();
        expect(t.isTSStringKeyword(nameType!.typeAnnotation)).toBe(true);

        const countType = propTypes.find((p) => p.name === "count");
        expect(countType).toBeDefined();
        expect(t.isTSNumberKeyword(countType!.typeAnnotation)).toBe(true);

        const enabledType = propTypes.find((p) => p.name === "enabled");
        expect(enabledType).toBeDefined();
        expect(t.isTSBooleanKeyword(enabledType!.typeAnnotation)).toBe(true);
      }
    });

    it("should handle function dependencies", () => {
      // Arrange
      const inferrer = new TypeInferrer();
      const code = "const handleClick: () => void = () => {};";
      const dependencyResult = createFunctionDependency(code, "handleClick");
      const dependency = unwrapResult(dependencyResult);
      if (!dependency) return;

      // Act
      const result = inferrer.inferPropTypes([dependency]);

      // Assert
      expect(result.ok).toBe(true);
      if (result.ok) {
        const propTypes = result.value;
        expect(propTypes).toHaveLength(1);
        const propType = requireFirst(propTypes, "prop type");
        if (!propType) return;
        expect(propType.name).toBe("handleClick");
        // Function type should be a TSFunctionType
        expect(t.isTSFunctionType(propType.typeAnnotation)).toBe(true);
      }
    });

    it("should use unknown type when type annotation is missing", () => {
      // Arrange
      const inferrer = new TypeInferrer();
      const code = 'const value = "test";'; // No type annotation
      const dependencyResult = createVariableDependency(code, "value");
      const dependency = unwrapResult(dependencyResult);
      if (!dependency) return;

      // Act
      const result = inferrer.inferPropTypes([dependency]);

      // Assert
      expect(result.ok).toBe(true);
      if (result.ok) {
        const propTypes = result.value;
        expect(propTypes).toHaveLength(1);
        const propType = requireFirst(propTypes, "prop type");
        if (!propType) return;
        expect(propType.name).toBe("value");
        // Should default to unknown type when no annotation
        expect(t.isTSUnknownKeyword(propType.typeAnnotation)).toBe(true);
      }
    });
  });

  describe("buildPropsInterface - Props interface generation", () => {
    it("should build Props interface with basic types", () => {
      // Arrange
      const inferrer = new TypeInferrer();
      const propTypes = [
        {
          name: "userName",
          typeAnnotation: t.tsStringKeyword(),
          optional: false,
        },
        {
          name: "age",
          typeAnnotation: t.tsNumberKeyword(),
          optional: false,
        },
        {
          name: "isActive",
          typeAnnotation: t.tsBooleanKeyword(),
          optional: false,
        },
      ];
      const interfaceName = "UserProfileProps";

      // Act
      const result = inferrer.buildPropsInterface(propTypes, interfaceName);

      // Assert
      expect(t.isTSInterfaceDeclaration(result)).toBe(true);
      expect(result.id.name).toBe("UserProfileProps");
      expect(result.body.body).toHaveLength(3);

      // Check properties
      const properties = result.body.body;
      const prop0 = requirePropertySignature(properties, 0);
      const prop1 = requirePropertySignature(properties, 1);
      const prop2 = requirePropertySignature(properties, 2);
      expect(t.isTSPropertySignature(prop0)).toBe(true);
      expect(t.isTSPropertySignature(prop1)).toBe(true);
      expect(t.isTSPropertySignature(prop2)).toBe(true);

      // Verify property names
      expect(t.isIdentifier(prop0?.key)).toBe(true);
      if (t.isIdentifier(prop0?.key)) {
        expect(prop0.key.name).toBe("userName");
      }
    });

    it("should handle optional properties", () => {
      // Arrange
      const inferrer = new TypeInferrer();
      const propTypes = [
        {
          name: "name",
          typeAnnotation: t.tsStringKeyword(),
          optional: false,
        },
        {
          name: "email",
          typeAnnotation: t.tsStringKeyword(),
          optional: true,
        },
      ];
      const interfaceName = "ContactProps";

      // Act
      const result = inferrer.buildPropsInterface(propTypes, interfaceName);

      // Assert
      expect(result.body.body).toHaveLength(2);
      const properties = result.body.body;

      const nameProp = requirePropertySignature(properties, 0);
      const emailProp = requirePropertySignature(properties, 1);
      if (!nameProp || !emailProp) return;
      expect(nameProp.optional).toBe(false);
      expect(emailProp.optional).toBe(true);
    });

    it("should handle empty props interface", () => {
      // Arrange
      const inferrer = new TypeInferrer();
      const propTypes: PropType[] = [];
      const interfaceName = "EmptyProps";

      // Act
      const result = inferrer.buildPropsInterface(propTypes, interfaceName);

      // Assert
      expect(t.isTSInterfaceDeclaration(result)).toBe(true);
      expect(result.id.name).toBe("EmptyProps");
      expect(result.body.body).toHaveLength(0);
    });

    it("should preserve type annotations for complex types", () => {
      // Arrange
      const inferrer = new TypeInferrer();
      const valueIdentifier = t.identifier("value");
      valueIdentifier.typeAnnotation = t.tsTypeAnnotation(t.tsStringKeyword());

      const propTypes = [
        {
          name: "callback",
          typeAnnotation: t.tsFunctionType(
            null,
            [valueIdentifier],
            t.tsTypeAnnotation(t.tsVoidKeyword())
          ),
          optional: false,
        },
      ];
      const interfaceName = "CallbackProps";

      // Act
      const result = inferrer.buildPropsInterface(propTypes, interfaceName);

      // Assert
      expect(result.body.body).toHaveLength(1);
      const prop = requirePropertySignature(result.body.body, 0);
      if (!prop) return;
      expect(prop.typeAnnotation).toBeDefined();
      if (prop.typeAnnotation) {
        expect(t.isTSFunctionType(prop.typeAnnotation.typeAnnotation)).toBe(
          true
        );
      }
    });
  });

  describe("inferPropTypes - Complex types", () => {
    it("should infer object type from variable dependency", () => {
      // Arrange
      const inferrer = new TypeInferrer();
      const code =
        'const user: { name: string; age: number } = { name: "John", age: 25 };';
      const dependencyResult = createVariableDependency(code, "user");
      const dependency = unwrapResult(dependencyResult);
      if (!dependency) return;

      // Act
      const result = inferrer.inferPropTypes([dependency]);

      // Assert
      expect(result.ok).toBe(true);
      if (result.ok) {
        const propTypes = result.value;
        expect(propTypes).toHaveLength(1);
        const propType = requireFirst(propTypes, "prop type");
        if (!propType) return;
        expect(propType.name).toBe("user");
        expect(t.isTSTypeLiteral(propType.typeAnnotation)).toBe(true);
      }
    });

    it("should infer array type from variable dependency", () => {
      // Arrange
      const inferrer = new TypeInferrer();
      const code = 'const items: string[] = ["a", "b", "c"];';
      const dependencyResult = createVariableDependency(code, "items");
      const dependency = unwrapResult(dependencyResult);
      if (!dependency) return;

      // Act
      const result = inferrer.inferPropTypes([dependency]);

      // Assert
      expect(result.ok).toBe(true);
      if (result.ok) {
        const propTypes = result.value;
        expect(propTypes).toHaveLength(1);
        const propType = requireFirst(propTypes, "prop type");
        if (!propType) return;
        expect(propType.name).toBe("items");
        if (!t.isTSArrayType(propType.typeAnnotation)) {
          throw new Error("Expected array type annotation");
        }
        expect(t.isTSStringKeyword(propType.typeAnnotation.elementType)).toBe(
          true
        );
      }
    });

    it("should infer union type from variable dependency", () => {
      // Arrange
      const inferrer = new TypeInferrer();
      const code =
        'const status: "active" | "inactive" | "pending" = "active";';
      const dependencyResult = createVariableDependency(code, "status");
      const dependency = unwrapResult(dependencyResult);
      if (!dependency) return;

      // Act
      const result = inferrer.inferPropTypes([dependency]);

      // Assert
      expect(result.ok).toBe(true);
      if (result.ok) {
        const propTypes = result.value;
        expect(propTypes).toHaveLength(1);
        const propType = requireFirst(propTypes, "prop type");
        if (!propType) return;
        expect(propType.name).toBe("status");
        if (!t.isTSUnionType(propType.typeAnnotation)) {
          throw new Error("Expected union type annotation");
        }
        expect(propType.typeAnnotation.types).toHaveLength(3);
      }
    });

    it("should infer tuple type from variable dependency", () => {
      // Arrange
      const inferrer = new TypeInferrer();
      const code = 'const pair: [string, number] = ["test", 42];';
      const dependencyResult = createVariableDependency(code, "pair");
      const dependency = unwrapResult(dependencyResult);
      if (!dependency) return;

      // Act
      const result = inferrer.inferPropTypes([dependency]);

      // Assert
      expect(result.ok).toBe(true);
      if (result.ok) {
        const propTypes = result.value;
        expect(propTypes).toHaveLength(1);
        const propType = requireFirst(propTypes, "prop type");
        if (!propType) return;
        expect(propType.name).toBe("pair");
        if (!t.isTSTupleType(propType.typeAnnotation)) {
          throw new Error("Expected tuple type annotation");
        }
        expect(propType.typeAnnotation.elementTypes).toHaveLength(2);
      }
    });

    it("should infer optional type from union with undefined", () => {
      // Arrange
      const inferrer = new TypeInferrer();
      const code = "const value: string | undefined = undefined;";
      const dependencyResult = createVariableDependency(code, "value");
      const dependency = unwrapResult(dependencyResult);
      if (!dependency) return;

      // Act
      const result = inferrer.inferPropTypes([dependency]);

      // Assert
      expect(result.ok).toBe(true);
      if (result.ok) {
        const propTypes = result.value;
        expect(propTypes).toHaveLength(1);
        const propType = requireFirst(propTypes, "prop type");
        if (!propType) return;
        expect(propType.name).toBe("value");
        // Union with undefined should result in optional property
        expect(propType.optional).toBe(true);
        // The type annotation should be just string (without undefined)
        expect(t.isTSStringKeyword(propType.typeAnnotation)).toBe(true);
      }
    });

    it("should handle complex nested types", () => {
      // Arrange
      const inferrer = new TypeInferrer();
      const code =
        "const data: { users: Array<{ id: number; name: string }> } = { users: [] };";
      const dependencyResult = createVariableDependency(code, "data");
      const dependency = unwrapResult(dependencyResult);
      if (!dependency) return;

      // Act
      const result = inferrer.inferPropTypes([dependency]);

      // Assert
      expect(result.ok).toBe(true);
      if (result.ok) {
        const propTypes = result.value;
        expect(propTypes).toHaveLength(1);
        const propType = requireFirst(propTypes, "prop type");
        if (!propType) return;
        expect(propType.name).toBe("data");
        expect(t.isTSTypeLiteral(propType.typeAnnotation)).toBe(true);
      }
    });
  });
});
