#!/usr/bin/env node
/**
 * Fix CJS Extensions
 *
 * Renames .js files to .cjs in the CommonJS build output
 * to ensure proper module resolution for dual ESM/CJS packages.
 */

import { readdir, rename } from 'fs/promises';
import { join, extname } from 'path';

async function renameJsToCjs(dir) {
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      await renameJsToCjs(fullPath);
    } else if (entry.isFile() && extname(entry.name) === '.js') {
      const newPath = fullPath.replace(/\.js$/, '.cjs');
      await rename(fullPath, newPath);
      console.log(`Renamed: ${fullPath} -> ${newPath}`);
    }
  }
}

const cjsDir = join(process.cwd(), 'dist', 'cjs');
console.log(`Fixing CJS extensions in: ${cjsDir}`);

renameJsToCjs(cjsDir)
  .then(() => {
    console.log('✓ All .js files renamed to .cjs');
  })
  .catch((error) => {
    console.error('Error fixing CJS extensions:', error);
    process.exit(1);
  });
