/**
 * Test Utilities for Regrafter
 *
 * Helper functions for loading fixtures and creating test data.
 */

import * as fs from 'fs';
import * as path from 'path';
import type { PositionSelector, PathSelector, FileInput } from '../src/types/public.js';

// =============================================================================
// Fixture Loading
// =============================================================================

const FIXTURES_DIR = path.join(__dirname, 'fixtures');

/**
 * Load a fixture file by name.
 */
export function loadFixture(filename: string): string {
  const filepath = path.join(FIXTURES_DIR, filename);
  return fs.readFileSync(filepath, 'utf-8');
}

/**
 * Load multiple fixture files.
 */
export function loadFixtures(filenames: string[]): FileInput[] {
  return filenames.map(filename => ({
    path: filename,
    content: loadFixture(filename),
  }));
}

/**
 * Check if a fixture file exists.
 */
export function fixtureExists(filename: string): boolean {
  const filepath = path.join(FIXTURES_DIR, filename);
  return fs.existsSync(filepath);
}

// =============================================================================
// Selector Factories
// =============================================================================

/**
 * Create a position selector.
 */
export function position(
  file: string,
  line: number,
  column: number
): PositionSelector {
  return { file, line, column };
}

/**
 * Create a path selector.
 */
export function astPath(file: string, path: string): PathSelector {
  return { file, path };
}

// =============================================================================
// Code Assertion Helpers
// =============================================================================

/**
 * Check if code contains a specific pattern.
 */
export function codeContains(code: string, pattern: string | RegExp): boolean {
  if (typeof pattern === 'string') {
    return code.includes(pattern);
  }
  return pattern.test(code);
}

/**
 * Check if code contains all specified patterns.
 */
export function codeContainsAll(code: string, patterns: (string | RegExp)[]): boolean {
  return patterns.every(pattern => codeContains(code, pattern));
}

/**
 * Count occurrences of a pattern in code.
 */
export function countOccurrences(code: string, pattern: string | RegExp): number {
  if (typeof pattern === 'string') {
    return (code.match(new RegExp(escapeRegex(pattern), 'g')) || []).length;
  }
  return (code.match(new RegExp(pattern.source, 'g')) || []).length;
}

/**
 * Escape special regex characters in a string.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// =============================================================================
// Line/Column Helpers
// =============================================================================

/**
 * Find line number containing a specific string.
 */
export function findLineContaining(code: string, text: string): number {
  const lines = code.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i]?.includes(text)) {
      return i + 1; // 1-based line numbers
    }
  }
  return -1;
}

/**
 * Find column position of text within a line.
 */
export function findColumnOf(code: string, text: string, lineNumber: number): number {
  const lines = code.split('\n');
  const line = lines[lineNumber - 1];
  if (!line) return -1;
  return line.indexOf(text) + 1; // 1-based column numbers
}

/**
 * Create a position selector by searching for text in code.
 */
export function findPosition(
  file: string,
  code: string,
  text: string
): PositionSelector | null {
  const line = findLineContaining(code, text);
  if (line === -1) return null;
  const column = findColumnOf(code, text, line);
  if (column === -1) return null;
  return position(file, line, column);
}

// =============================================================================
// AST Helpers
// =============================================================================

/**
 * Simple check if code appears to be valid JSX/TSX.
 */
export function isValidJSX(code: string): boolean {
  // Basic check for balanced JSX-like tags
  const openTags = (code.match(/<[A-Z][a-zA-Z]*|<[a-z]+/g) || []).length;
  const closeTags = (code.match(/<\/[A-Za-z]+>|\/>/g) || []).length;
  return openTags > 0 && closeTags > 0;
}

// =============================================================================
// Diff Helpers
// =============================================================================

/**
 * Get simple diff between two code strings.
 */
export function simpleDiff(
  original: string,
  modified: string
): { added: string[]; removed: string[] } {
  const originalLines = original.split('\n');
  const modifiedLines = modified.split('\n');

  const removed = originalLines.filter(line => !modifiedLines.includes(line));
  const added = modifiedLines.filter(line => !originalLines.includes(line));

  return { added, removed };
}

// =============================================================================
// Test Data Generators
// =============================================================================

/**
 * Generate a simple component string.
 */
export function generateComponent(name: string, children: string = ''): string {
  return `
export function ${name}() {
  return (
    <div className="${name.toLowerCase()}">
      ${children}
    </div>
  );
}
`.trim();
}

/**
 * Generate a component with state.
 */
export function generateStatefulComponent(
  name: string,
  stateName: string = 'value'
): string {
  return `
import { useState } from 'react';

export function ${name}() {
  const [${stateName}, set${capitalize(stateName)}] = useState(null);

  return (
    <div className="${name.toLowerCase()}">
      <span>{${stateName}}</span>
      <button onClick={() => set${capitalize(stateName)}('clicked')}>Click</button>
    </div>
  );
}
`.trim();
}

/**
 * Capitalize first letter.
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// =============================================================================
// Timing Helpers
// =============================================================================

/**
 * Measure execution time of an async function.
 */
export async function measureTime<T>(fn: () => Promise<T>): Promise<{ result: T; ms: number }> {
  const start = performance.now();
  const result = await fn();
  const ms = performance.now() - start;
  return { result, ms };
}

/**
 * Measure execution time of a sync function.
 */
export function measureTimeSync<T>(fn: () => T): { result: T; ms: number } {
  const start = performance.now();
  const result = fn();
  const ms = performance.now() - start;
  return { result, ms };
}
