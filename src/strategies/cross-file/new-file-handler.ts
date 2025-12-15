/**
 * New File Handler
 *
 * Handles creation of new files when target file doesn't exist.
 * Implements task 4.4.1 from the task list.
 */

import generateCode from '@babel/generator';
import * as t from '@babel/types';

import { createCode } from '../../types/factories.js';
import type { ImportOperation } from '../../types/internal.js';
import type { Code } from '../../types/public.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Configuration for new file generation.
 */
export interface NewFileConfig {
  /** Whether to include 'use client' directive (for Next.js) */
  useClient?: boolean;
  /** Whether to include 'use server' directive (for Next.js) */
  useServer?: boolean;
  /** Default imports to include */
  defaultImports?: ImportOperation[];
  /** Whether this is a TypeScript file */
  typescript?: boolean;
  /** Component name for the file (if creating a component file) */
  componentName?: string;
}

/**
 * Result of new file creation.
 */
export interface NewFileResult {
  /** The AST for the new file */
  ast: t.File;
  /** The generated code */
  code: string;
  /** The file path */
  filePath: string;
  /** Code object for the result */
  codeResult: Code;
}

/**
 * File type detection result.
 */
export interface FileTypeInfo {
  /** Whether this is a TypeScript file */
  isTypeScript: boolean;
  /** Whether this is a JSX/TSX file */
  isJsx: boolean;
  /** The file extension */
  extension: string;
  /** Suggested component name based on file path */
  suggestedComponentName: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// New File Detection (4.4.1)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Checks if a target file exists in the files collection.
 *
 * @param targetFile - Path to the target file
 * @param existingFiles - Collection of existing files
 * @returns True if the file doesn't exist
 */
export function isNewFile(
  targetFile: string,
  existingFiles: Map<string, unknown> | Set<string> | string[]
): boolean {
  const normalizedTarget = normalizePath(targetFile);

  if (existingFiles instanceof Map) {
    for (const key of existingFiles.keys()) {
      if (normalizePath(key) === normalizedTarget) {
        return false;
      }
    }
    return true;
  }

  if (existingFiles instanceof Set) {
    for (const file of existingFiles) {
      if (normalizePath(file) === normalizedTarget) {
        return false;
      }
    }
    return true;
  }

  // Array case
  for (const file of existingFiles) {
    if (normalizePath(file) === normalizedTarget) {
      return false;
    }
  }
  return true;
}

/**
 * Detects file type information from a file path.
 *
 * @param filePath - Path to analyze
 * @returns File type information
 */
export function detectFileType(filePath: string): FileTypeInfo {
  const normalizedPath = normalizePath(filePath);
  const parts = normalizedPath.split('/');
  const fileName = parts.pop() ?? '';

  // Detect extension
  const extensionMatch = fileName.match(/\.(tsx?|jsx?|mjs)$/);
  const extension = extensionMatch ? extensionMatch[1] : 'tsx';

  const isTypeScript = extension.startsWith('ts');
  const isJsx = extension === 'tsx' || extension === 'jsx';

  // Generate suggested component name from file name
  const baseName = fileName.replace(/\.[^.]+$/, '');
  const suggestedComponentName = toPascalCase(baseName);

  return {
    isTypeScript,
    isJsx,
    extension,
    suggestedComponentName,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Empty Component File Generation
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generates a valid empty React component file structure.
 *
 * @param filePath - Path for the new file
 * @param config - Configuration options
 * @returns New file result
 */
export function generateEmptyComponentFile(
  filePath: string,
  config: NewFileConfig = {}
): NewFileResult {
  const fileInfo = detectFileType(filePath);
  const componentName = config.componentName ?? fileInfo.suggestedComponentName;

  const statements: t.Statement[] = [];

  // Add 'use client' or 'use server' directive if specified
  if (config.useClient) {
    statements.push(
      t.expressionStatement(t.stringLiteral('use client'))
    );
  } else if (config.useServer) {
    statements.push(
      t.expressionStatement(t.stringLiteral('use server'))
    );
  }

  // Add React import
  statements.push(
    t.importDeclaration(
      [t.importDefaultSpecifier(t.identifier('React'))],
      t.stringLiteral('react')
    )
  );

  // Add default imports if specified
  if (config.defaultImports) {
    for (const importOp of config.defaultImports) {
      const specifiers = importOp.specifiers.map((spec) => {
        if (spec.type === 'default') {
          return t.importDefaultSpecifier(t.identifier(spec.local));
        } else if (spec.type === 'namespace') {
          return t.importNamespaceSpecifier(t.identifier(spec.local));
        } else {
          return t.importSpecifier(
            t.identifier(spec.imported),
            t.identifier(spec.local)
          );
        }
      });

      statements.push(
        t.importDeclaration(specifiers, t.stringLiteral(importOp.importSource))
      );
    }
  }

  // Add component props type (for TypeScript)
  if (fileInfo.isTypeScript) {
    const propsTypeName = `${componentName}Props`;
    const propsType = t.tsInterfaceDeclaration(
      t.identifier(propsTypeName),
      null,
      null,
      t.tsInterfaceBody([
        t.tsPropertySignature(
          t.identifier('children'),
          t.tsTypeAnnotation(
            t.tsTypeReference(
              t.tsQualifiedName(t.identifier('React'), t.identifier('ReactNode'))
            )
          )
        ),
      ])
    );
    propsType.leadingComments = [
      {
        type: 'CommentBlock',
        value: `*\n * Props for ${componentName} component.\n `,
      } as t.CommentBlock,
    ];
    statements.push(propsType);
  }

  // Create component function
  const componentFunction = createComponentFunction(
    componentName,
    fileInfo.isTypeScript
  );

  // Add export default
  statements.push(t.exportDefaultDeclaration(componentFunction));

  // Create the AST
  const ast = t.file(t.program(statements, [], 'module'));

  // Generate code
  const result = generateCode(ast, {
    comments: true,
    compact: false,
    jsescOption: { quotes: 'single' },
  });

  const codeResult = createCode({
    file: filePath,
    content: result.code,
    changed: true,
    isNew: true,
  });

  return {
    ast,
    code: result.code,
    filePath,
    codeResult,
  };
}

/**
 * Creates a React function component AST node.
 */
function createComponentFunction(
  name: string,
  isTypeScript: boolean
): t.FunctionDeclaration {
  const propsParam = t.identifier('props');

  if (isTypeScript) {
    propsParam.typeAnnotation = t.tsTypeAnnotation(
      t.tsTypeReference(t.identifier(`${name}Props`))
    );
  }

  // Component body: return <div>{props.children}</div>
  const jsxChildren = t.jsxExpressionContainer(
    t.memberExpression(t.identifier('props'), t.identifier('children'))
  );

  const jsxElement = t.jsxElement(
    t.jsxOpeningElement(t.jsxIdentifier('div'), [], false),
    t.jsxClosingElement(t.jsxIdentifier('div')),
    [jsxChildren],
    false
  );

  const returnStatement = t.returnStatement(jsxElement);

  const functionDecl = t.functionDeclaration(
    t.identifier(name),
    [propsParam],
    t.blockStatement([returnStatement])
  );

  // Add return type for TypeScript
  if (isTypeScript) {
    functionDecl.returnType = t.tsTypeAnnotation(
      t.tsTypeReference(
        t.tsQualifiedName(t.identifier('React'), t.identifier('ReactElement'))
      )
    );
  }

  // Add JSDoc comment
  functionDecl.leadingComments = [
    {
      type: 'CommentBlock',
      value: `*\n * ${name} component.\n `,
    } as t.CommentBlock,
  ];

  return functionDecl;
}

/**
 * Generates an empty file with just imports (for non-component files).
 *
 * @param filePath - Path for the new file
 * @param imports - Imports to include
 * @returns New file result
 */
export function generateEmptyFile(
  filePath: string,
  imports: ImportOperation[] = []
): NewFileResult {
  const statements: t.Statement[] = [];

  // Add imports
  for (const importOp of imports) {
    const specifiers = importOp.specifiers.map((spec) => {
      if (spec.type === 'default') {
        return t.importDefaultSpecifier(t.identifier(spec.local));
      } else if (spec.type === 'namespace') {
        return t.importNamespaceSpecifier(t.identifier(spec.local));
      } else {
        return t.importSpecifier(
          t.identifier(spec.imported),
          t.identifier(spec.local)
        );
      }
    });

    statements.push(
      t.importDeclaration(specifiers, t.stringLiteral(importOp.importSource))
    );
  }

  // Add a placeholder comment
  statements.push(
    t.emptyStatement()
  );

  const ast = t.file(t.program(statements, [], 'module'));

  // Add file header comment
  ast.comments = [
    {
      type: 'CommentBlock',
      value: `*\n * Auto-generated file\n `,
    } as t.CommentBlock,
  ];

  const result = generateCode(ast, {
    comments: true,
    compact: false,
    jsescOption: { quotes: 'single' },
  });

  const codeResult = createCode({
    file: filePath,
    content: result.code,
    changed: true,
    isNew: true,
  });

  return {
    ast,
    code: result.code,
    filePath,
    codeResult,
  };
}

/**
 * Generates a shared module file structure.
 *
 * @param filePath - Path for the shared module
 * @param exports - Symbols to export
 * @returns New file result
 */
export function generateSharedModuleFile(
  filePath: string,
  exports: Array<{ name: string; node: t.Declaration }>
): NewFileResult {
  const statements: t.Statement[] = [];

  // Add file header comment
  const headerComment: t.CommentBlock = {
    type: 'CommentBlock',
    value: `*\n * Shared module - auto-generated\n * Contains shared dependencies extracted for cross-file moves.\n `,
  };

  // Add exports
  for (const exp of exports) {
    const exportDecl = t.exportNamedDeclaration(exp.node, []);
    statements.push(exportDecl);
  }

  const ast = t.file(t.program(statements, [], 'module'));
  ast.comments = [headerComment];

  const result = generateCode(ast, {
    comments: true,
    compact: false,
    jsescOption: { quotes: 'single' },
  });

  const codeResult = createCode({
    file: filePath,
    content: result.code,
    changed: true,
    isNew: true,
  });

  return {
    ast,
    code: result.code,
    filePath,
    codeResult,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Utility Functions
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Normalizes a file path.
 */
function normalizePath(filePath: string): string {
  return filePath.replace(/^\.\//, '').replace(/\\/g, '/');
}

/**
 * Converts a string to PascalCase.
 */
function toPascalCase(str: string): string {
  return str
    .split(/[-_.\s]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join('');
}

/**
 * Checks if a file path looks like a React component file.
 *
 * @param filePath - Path to check
 * @returns True if this appears to be a component file
 */
export function isComponentFile(filePath: string): boolean {
  const normalizedPath = normalizePath(filePath);
  const fileName = normalizedPath.split('/').pop() ?? '';

  // Check if file name starts with uppercase (convention for components)
  const baseName = fileName.replace(/\.[^.]+$/, '');
  if (baseName.charAt(0) === baseName.charAt(0).toUpperCase()) {
    return true;
  }

  // Check if path contains common component directories
  const componentDirs = [
    '/components/',
    '/pages/',
    '/views/',
    '/screens/',
    '/containers/',
  ];

  return componentDirs.some((dir) => normalizedPath.includes(dir));
}

/**
 * Validates that a file path is valid for creation.
 *
 * @param filePath - Path to validate
 * @returns Validation result
 */
export function validateNewFilePath(
  filePath: string
): { valid: boolean; error?: string } {
  const normalized = normalizePath(filePath);

  // Check for invalid characters
  if (/[<>:"|?*]/.test(normalized)) {
    return { valid: false, error: 'File path contains invalid characters' };
  }

  // Check for valid extension
  if (!/\.(tsx?|jsx?|mjs)$/.test(normalized)) {
    return {
      valid: false,
      error: 'File path must have a valid JavaScript/TypeScript extension',
    };
  }

  // Check path is not empty
  if (normalized.length === 0) {
    return { valid: false, error: 'File path cannot be empty' };
  }

  return { valid: true };
}

/**
 * Generates a unique file path if the target already exists.
 *
 * @param basePath - Desired file path
 * @param existingFiles - Set of existing file paths
 * @returns Unique file path
 */
export function generateUniqueFilePath(
  basePath: string,
  existingFiles: Set<string>
): string {
  const normalized = normalizePath(basePath);

  if (!existingFiles.has(normalized)) {
    return basePath;
  }

  // Add number suffix
  const parts = normalized.split('.');
  const extension = parts.pop();
  const base = parts.join('.');

  let counter = 1;
  let newPath = `${base}.${counter}.${extension}`;

  while (existingFiles.has(newPath)) {
    counter++;
    newPath = `${base}.${counter}.${extension}`;
  }

  return newPath;
}
