/**
 * TypeStringifier
 *
 * Converts TypeScript AST type nodes to string representations
 * Extracted from ExtractOrchestrator to follow Single Responsibility Principle
 */

import * as t from '@babel/types';

export class TypeStringifier {
  /**
   * Convert TypeScript type AST to string
   *
   * @param typeAnnotation - Type AST node
   * @returns Type string representation
   */
  toString(typeAnnotation: t.TSType): string {
    // Primitive types
    if (t.isTSAnyKeyword(typeAnnotation)) {
      return 'any';
    }
    if (t.isTSStringKeyword(typeAnnotation)) {
      return 'string';
    }
    if (t.isTSNumberKeyword(typeAnnotation)) {
      return 'number';
    }
    if (t.isTSBooleanKeyword(typeAnnotation)) {
      return 'boolean';
    }
    if (t.isTSVoidKeyword(typeAnnotation)) {
      return 'void';
    }
    if (t.isTSUndefinedKeyword(typeAnnotation)) {
      return 'undefined';
    }
    if (t.isTSNullKeyword(typeAnnotation)) {
      return 'null';
    }

    // Type references (e.g., User, React.ReactNode)
    if (t.isTSTypeReference(typeAnnotation)) {
      if (t.isIdentifier(typeAnnotation.typeName)) {
        return typeAnnotation.typeName.name;
      }
      if (t.isTSQualifiedName(typeAnnotation.typeName)) {
        return this.qualifiedNameToString(typeAnnotation.typeName);
      }
    }

    // Union types (e.g., 'active' | 'inactive')
    if (t.isTSUnionType(typeAnnotation)) {
      return typeAnnotation.types.map(t => this.toString(t)).join(' | ');
    }

    // Array types (e.g., string[])
    if (t.isTSArrayType(typeAnnotation)) {
      return `${this.toString(typeAnnotation.elementType)}[]`;
    }

    // Literal types (e.g., 'active', 42, true)
    if (t.isTSLiteralType(typeAnnotation)) {
      const literal = typeAnnotation.literal;
      if (t.isStringLiteral(literal)) {
        return `'${literal.value}'`;
      }
      if (t.isNumericLiteral(literal)) {
        return String(literal.value);
      }
      if (t.isBooleanLiteral(literal)) {
        return String(literal.value);
      }
    }

    // Function types (e.g., (x: number) => string)
    if (t.isTSFunctionType(typeAnnotation)) {
      const params = typeAnnotation.parameters.map(p => {
        if (t.isIdentifier(p) && p.typeAnnotation && t.isTSTypeAnnotation(p.typeAnnotation)) {
          return `${p.name}: ${this.toString(p.typeAnnotation.typeAnnotation)}`;
        }
        return 'any';
      }).join(', ');
      const returnType = typeAnnotation.typeAnnotation
        ? this.toString(typeAnnotation.typeAnnotation.typeAnnotation)
        : 'void';
      return `(${params}) => ${returnType}`;
    }

    // Default fallback
    return 'any';
  }

  /**
   * Convert a TSQualifiedName to string (e.g., React.ReactNode)
   *
   * @param name - TSQualifiedName node
   * @returns String representation
   */
  private qualifiedNameToString(name: t.TSQualifiedName): string {
    const left = t.isIdentifier(name.left)
      ? name.left.name
      : this.qualifiedNameToString(name.left as t.TSQualifiedName);
    const right = name.right.name;
    return `${left}.${right}`;
  }
}
