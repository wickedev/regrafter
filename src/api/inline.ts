/**
 * Inline API Implementation
 *
 * Inline a React component by replacing its usage with its implementation.
 *
 * @module api/inline
 */

import traverseModule from '@babel/traverse';
import type { NodePath } from '@babel/traverse';
import type * as t from '@babel/types';
import * as t_factory from '@babel/types';

import { findComponentDefinition } from '../analyzer/component-detector.js';
import { error } from '../errors/error-builder.js';
import type { RegraffError } from '../errors/index.js';
import { createInternalError } from '../errors/index.js';
import { CodeGenerator } from '../generator/code-generator.js';
import { parseFile } from '../parser/parse-file.js';
import { err, isErr, ok, type Result } from '../result/index.js';
import { ComponentInliner } from '../transformer/component-inliner.js';
import type { Code, FileInput } from '../types/index.js';
import { loadTraverseFunction } from '../utils/index.js';

import { parseAllFiles } from './parse-utils.js';

const traverse = loadTraverseFunction(traverseModule);

/**
 * Result of a component inline operation
 */
export interface InlineResult {
  /** Array of file contents with inlined components */
  codes: Code[];
  /** Number of component instances inlined */
  inlinedCount: number;
}

/**
 * Component specification for inline operation
 */
export interface Component {
  /** File path containing the component definition */
  file: string;
  /** Name of the component to inline */
  name: string;
}

/**
 * Inline a React component by replacing its usage with its implementation.
 *
 * This function finds a component definition in a specified file and replaces all usages
 * with the component's implementation, performing prop substitution inline.
 * The original component definition is removed.
 *
 * Supported features:
 * - Simple presentational components
 * - Components with props (destructured parameters)
 * - Components with React hooks (useState, useEffect, useRef, etc.)
 * - Cross-file inlining with automatic import management
 * - Transitive import resolution
 * - Prop substitution as inline expressions
 *
 * @param files - Array of file inputs with path and content
 * @param component - Component specification with file path and name
 * @returns Result containing transformed codes and inline count, or error
 *
 * @example
 * **Same-file inlining**
 * ```typescript
 * const files = [{
 *   path: 'App.tsx',
 *   content: `
 *     function Greeting({ name }) {
 *       return <div>Hello {name}</div>;
 *     }
 *     function App() {
 *       return <Greeting name="World" />;
 *     }
 *   `
 * }];
 *
 * const result = inline(files, { file: 'App.tsx', name: 'Greeting' });
 *
 * if (result.ok) {
 *   console.log('Inlined:', result.value.inlinedCount, 'instances');
 *   console.log('Output:', result.value.codes[0].content);
 * } else {
 *   console.error('Error:', result.error.message);
 * }
 * ```
 *
 * @example
 * **Cross-file inlining**
 * ```typescript
 * const files = [
 *   {
 *     path: 'Button.tsx',
 *     content: `export function Button({ label }) { return <button>{label}</button>; }`
 *   },
 *   {
 *     path: 'App.tsx',
 *     content: `import { Button } from './Button'; function App() { return <Button label="Click" />; }`
 *   }
 * ];
 *
 * // Specify the file containing the component definition
 * const result = inline(files, { file: 'Button.tsx', name: 'Button' });
 * ```
 */
export function inline(
  files: FileInput[],
  component: Component
): Result<InlineResult, RegraffError> {
  try {
    // Validate inputs
    if (files.length === 0) {
      return err(
        error()
          .code('EMPTY_INPUT')
          .message('No files provided')
          .constraint('non_empty_array')
          .details('The files array cannot be empty')
          .build()
      );
    }

    if (component.name.trim() === '') {
      return err(
        error()
          .code('EMPTY_INPUT')
          .message('Component name cannot be empty')
          .constraint('non_empty_string')
          .details('The component.name parameter must be a non-empty string')
          .build()
      );
    }

    if (component.file.trim() === '') {
      return err(
        error()
          .code('EMPTY_INPUT')
          .message('Component file path cannot be empty')
          .constraint('non_empty_string')
          .details('The component.file parameter must be a non-empty string')
          .build()
      );
    }

    // Create required instances
    const generator = new CodeGenerator();
    const inliner = new ComponentInliner();

    // Parse all files
    const parseResult = parseAllFiles(files);
    if (isErr(parseResult)) {
      return err(parseResult.error);
    }
    const parsedFiles = parseResult.value;

    // Phase 3: Cross-file support
    // Step 1: Find the component definition in the specified file and clone it
    const componentFile = component.file;
    const componentName = component.name;

    // Helper function to clone AST
    const cloneAst = (ast: t.File, filePath: string): Result<t.File, RegraffError> => {
      const generateResult = generator.generate(ast);
      if (isErr(generateResult)) {
        return err(generateResult.error);
      }
      const cloneParseResult = parseFile(filePath, generateResult.value.code);
      if (isErr(cloneParseResult)) {
        return err(cloneParseResult.error);
      }
      return ok(cloneParseResult.value);
    };

    // Get the AST for the specified file
    const componentDefSourceAst = parsedFiles.get(componentFile);
    if (!componentDefSourceAst) {
      return err(
        error()
          .code('ELEMENT_NOT_FOUND')
          .message(`Component '${componentName}' not found in file '${componentFile}'`)
          .constraint('element_exists')
          .details(`The specified file '${componentFile}' does not exist in the files array`)
          .build()
      );
    }

    // Find the component in the specified file
    const componentInfo = findComponentDefinition(componentDefSourceAst, componentName);
    if (!componentInfo) {
      return err(
        error()
          .code('ELEMENT_NOT_FOUND')
          .message(`Component '${componentName}' not found in file '${componentFile}'`)
          .constraint('element_exists')
          .details(`The component '${componentName}' could not be found in the specified file '${componentFile}'`)
          .build()
      );
    }

    // Clone the AST for use in inlining
    const cloneResult = cloneAst(componentDefSourceAst, componentFile);
    if (isErr(cloneResult)) {
      return err(cloneResult.error);
    }
    const componentDefAst = cloneResult.value;

    // Step 2: Inline the component in all files (including the definition file)
    let totalInlinedCount = 0;
    const usageFiles: Set<string> = new Set();
    const modifiedAsts = new Map<string, t.File>();

    for (const [filePath, fileAst] of parsedFiles.entries()) {
      // Pass componentDefAst for all files (including definition file)
      // ComponentInliner will handle finding component in cross-file scenario
      // Only remove component definition in the file that contains it
      const shouldRemoveDefinition = filePath === componentFile;
      const result = inliner.inline(fileAst, componentName, componentDefAst, shouldRemoveDefinition);

      if (result.success && result.inlinedCount > 0) {
        // This file had usages that were inlined
        usageFiles.add(filePath);
        totalInlinedCount += result.inlinedCount;
        modifiedAsts.set(filePath, result.ast);

        // Copy transitive imports from component definition file (if cross-file)
        if (filePath !== componentFile) {
          copyTransitiveImports(result.ast, componentDefAst);
        }

        // Remove import statement for the component if it exists
        removeImportForComponent(result.ast, componentName);
      } else if (result.success) {
        // Component was found but no usages (definition file)
        modifiedAsts.set(filePath, result.ast);
      } else {
        // No changes to this file
        modifiedAsts.set(filePath, fileAst);
      }
    }

    // Generate code for all files
    const codes: Code[] = [];
    for (const file of files) {
      const finalAst = modifiedAsts.get(file.path) ?? parsedFiles.get(file.path);
      if (finalAst === undefined) {
        codes.push({
          file: file.path,
          content: file.content,
          changed: false,
        });
        continue;
      }

      const generateResult = generator.generate(finalAst);
      if (isErr(generateResult)) {
        return err(generateResult.error);
      }

      // File is changed if:
      // 1. It contained the component definition (componentFile)
      // 2. It had usages that were inlined (usageFiles)
      const changed = file.path === componentFile || usageFiles.has(file.path);

      codes.push({
        file: file.path,
        content: generateResult.value.code,
        changed,
      });
    }

    return ok({
      codes,
      inlinedCount: totalInlinedCount,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return err(createInternalError({
      code: 'INTERNAL_ERROR',
      message: `Internal error during inline operation: ${message}`,
      file: files[0]?.path ?? 'unknown',
      cause: error instanceof Error ? error : new Error(message),
    }));
  }
}

/**
 * Helper function to copy imports from component definition file to target file
 */
function copyTransitiveImports(targetAst: t.File, sourceAst: t.File): void {
  const importsToAdd: t.ImportDeclaration[] = [];

  // Extract all imports from the source file (component definition file)
  traverse(sourceAst, {
    ImportDeclaration(path: NodePath<t.ImportDeclaration>) {
      // Don't copy imports of the component itself or React imports (already present)
      const source = path.node.source.value;
      if (source !== 'react' && source !== 'React') {
        importsToAdd.push(t_factory.cloneNode(path.node, true));
      }
    },
  });

  // Add imports to the beginning of the target file
  if (importsToAdd.length > 0) {
    const programBody = targetAst.program.body;

    // Find the position after existing imports
    let insertPosition = 0;
    for (let i = 0; i < programBody.length; i++) {
      const node = programBody[i];
      if (node?.type === 'ImportDeclaration') {
        insertPosition = i + 1;
      } else {
        break;
      }
    }

    // Insert the new imports
    programBody.splice(insertPosition, 0, ...importsToAdd);
  }
}

/**
 * Helper function to remove import statements for an inlined component
 */
function removeImportForComponent(ast: t.File, componentName: string): void {
  traverse(ast, {
    ImportDeclaration(path: NodePath<t.ImportDeclaration>) {
      const specifiers = path.node.specifiers;

      // Remove the specifier for the component
      const filteredSpecifiers = specifiers.filter(spec => {
        if (spec.type === 'ImportSpecifier') {
          const imported = spec.imported;
          if (imported.type === 'Identifier' && imported.name === componentName) {
            return false; // Remove this specifier
          }
        }
        return true; // Keep other specifiers
      });

      // If no specifiers left, remove the entire import declaration
      if (filteredSpecifiers.length === 0) {
        path.remove();
      } else if (filteredSpecifiers.length < specifiers.length) {
        // Update specifiers if some were removed
        path.node.specifiers = filteredSpecifiers;
      }
    },
  });
}
