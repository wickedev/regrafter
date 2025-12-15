#!/usr/bin/env node
/**
 * Script to rename .js files to .cjs in the CJS build output
 * This ensures proper CommonJS resolution in Node.js
 */

import { readdir, rename, readFile, writeFile, stat } from 'fs/promises';
import { join, extname } from 'path';

const CJS_DIR = './dist/cjs';

async function processDirectory(dir) {
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      await processDirectory(fullPath);
    } else if (entry.isFile() && extname(entry.name) === '.js') {
      // Read file and update imports
      let content = await readFile(fullPath, 'utf-8');

      // Update require statements to use .cjs extension
      content = content.replace(
        /require\("(\.[^"]+)\.js"\)/g,
        'require("$1.cjs")'
      );

      // Update exports that reference .js files
      content = content.replace(
        /from\s+"(\.[^"]+)\.js"/g,
        'from "$1.cjs"'
      );

      // Write updated content
      await writeFile(fullPath, content, 'utf-8');

      // Rename file to .cjs
      const newPath = fullPath.replace(/\.js$/, '.cjs');
      await rename(fullPath, newPath);
      console.log(`Renamed: ${fullPath} -> ${newPath}`);
    }
  }
}

async function main() {
  try {
    const stats = await stat(CJS_DIR);
    if (!stats.isDirectory()) {
      console.error(`${CJS_DIR} is not a directory`);
      process.exit(1);
    }

    await processDirectory(CJS_DIR);
    console.log('CJS extension fix complete');
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log('No CJS build directory found, skipping');
    } else {
      console.error('Error:', error);
      process.exit(1);
    }
  }
}

main();
