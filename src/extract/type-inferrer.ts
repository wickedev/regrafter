/**
 * TypeInferrer
 *
 * Task 14.2: Basic TypeInferrer type implementation
 *
 * Infers TypeScript types from dependencies and builds Props interfaces
 */

import * as t from '@babel/types';

import type { RegraffError } from '../errors/error-category.js';
import { ok, type Result } from '../result/index.js';

import type { PropType, VariableDependency, FunctionDependency } from './types.js';

/**
 * Infer TypeScript types from dependencies and generate Props interface
 */
export class TypeInferrer {
  /**
   * Infer Props types from dependency list
   *
   * @param dependencies - Array of variable or function dependencies
   * @returns Result<PropType[], RegraffError>
   */
  inferPropTypes(
    dependencies: Array<VariableDependency | FunctionDependency>
  ): Result<PropType[], RegraffError> {
    const propTypes: PropType[] = [];

    for (const dep of dependencies) {
      const rawType = this.extractTypeAnnotation(dep);
      const { typeAnnotation, optional } = this.normalizeType(rawType);

      propTypes.push({
        name: dep.name,
        typeAnnotation,
        optional,
      });
    }

    return ok(propTypes);
  }

  /**
   * Extract TypeScript type AST from dependency
   */
  private extractTypeAnnotation(
    dep: VariableDependency | FunctionDependency
  ): t.TSType {
    // Use type as-is if already present
    if (dep.type) {
      return dep.type;
    }

    // Use any type if no type annotation
    return t.tsUnknownKeyword();
  }

  /**
   * Normalize type and determine optional status
   * Remove undefined from Union type and convert to optional
   */
  private normalizeType(type: t.TSType): { typeAnnotation: t.TSType; optional: boolean } {
    // Handle Union type
    if (t.isTSUnionType(type)) {
      const hasUndefined = type.types.some((tsType) => t.isTSUndefinedKeyword(tsType));

      if (hasUndefined) {
        // Extract only types excluding undefined
        const nonUndefinedTypes = type.types.filter((tsType) => !t.isTSUndefinedKeyword(tsType));

        // Replace with any type if only undefined
        if (nonUndefinedTypes.length === 0) {
          return { typeAnnotation: t.tsUnknownKeyword(), optional: true };
        }

        // Unwrap union if only one type remains
        if (nonUndefinedTypes.length === 1) {
          const firstType = nonUndefinedTypes[0];
          if (!firstType) {
            return { typeAnnotation: t.tsUnknownKeyword(), optional: true };
          }
          return { typeAnnotation: firstType, optional: true };
        }

        // Create new union if multiple types remain
        return { typeAnnotation: t.tsUnionType(nonUndefinedTypes), optional: true };
      }
    }

    // Not optional by default
    return { typeAnnotation: type, optional: false };
  }

  /**
   * Generate TypeScript Props interface from PropType array
   *
   * @param propTypes - Prop type array
   * @param interfaceName - Interface name to create
   * @returns TSInterfaceDeclaration
   */
  buildPropsInterface(
    propTypes: PropType[],
    interfaceName: string
  ): t.TSInterfaceDeclaration {
    const properties: t.TSPropertySignature[] = [];

    for (const propType of propTypes) {
      const property = t.tsPropertySignature(
        t.identifier(propType.name),
        t.tsTypeAnnotation(propType.typeAnnotation)
      );
      property.optional = propType.optional;
      properties.push(property);
    }

    const interfaceBody = t.tsInterfaceBody(properties);
    return t.tsInterfaceDeclaration(t.identifier(interfaceName), null, null, interfaceBody);
  }
}
