#!/usr/bin/env node
/**
 * Script to fix type narrowing issues by adding isErr imports where needed
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const srcDir = path.join(__dirname, 'src');

// Files that need isErr import
const filesToFix = [
  'src/index.ts',
  'src/generator/code-generator.ts',
  'src/analyzer/dependency-analyzer.ts',
];

function addIsErrImport(content, filePath) {
  // Check if isErr is already imported
  if (content.includes('isErr')) {
    console.log(`${filePath}: isErr already imported`);
    return content;
  }

  // Find the Result import line
  const resultImportRegex = /import\s+(?:type\s+)?\{([^}]+)\}\s+from\s+['"]\.\.?\/result\/index\.js['"]/;
  const match = content.match(resultImportRegex);

  if (!match) {
    console.log(`${filePath}: No Result import found`);
    return content;
  }

  const imports = match[1];
  const newImports = imports.trim() + ', isErr';

  const newContent = content.replace(
    resultImportRegex,
    `import { ${newImports} } from '../result/index.js'`
  );

  console.log(`${filePath}: Added isErr import`);
  return newContent;
}

// Process each file
for (const file of filesToFix) {
  const fullPath = path.join(__dirname, file);

  if (!fs.existsSync(fullPath)) {
    console.log(`File not found: ${fullPath}`);
    continue;
  }

  const content = fs.readFileSync(fullPath, 'utf-8');
  const newContent = addIsErrImport(content, file);

  if (content !== newContent) {
    fs.writeFileSync(fullPath, newContent, 'utf-8');
    console.log(`${file}: Updated`);
  }
}

console.log('Done!');
