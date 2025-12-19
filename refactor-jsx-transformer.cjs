#!/usr/bin/env node
/**
 * Script to refactor JSXTransformer by removing move methods
 * and delegating helper methods to the helpers module
 */

const fs = require('fs');
const path = require('path');

const filePath = '/Users/krenginelryan.y/Workspace/regrafter/src/transformer/jsx-transformer.ts';
const content = fs.readFileSync(filePath, 'utf-8');
const lines = content.split('\n');

// Find the line ranges to remove
let inMoveInside = false;
let inMoveBefore = false;
let inMoveAfter = false;
let startLine = -1;
let endLine = -1;

const linesToRemove = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];

  // Detect start of moveInside method
  if (line.trim().startsWith('moveInside(')) {
    startLine = i;
    // Find the comment block before it
    let commentStart = i - 1;
    while (commentStart >= 0 && (lines[commentStart].trim().startsWith('*') || lines[commentStart].trim().startsWith('/**') || lines[commentStart].trim() === '')) {
      commentStart--;
    }
    startLine = commentStart + 1;
    inMoveInside = true;
  }

  // Detect start of moveBefore method
  if (line.trim().startsWith('moveBefore(')) {
    startLine = i;
    let commentStart = i - 1;
    while (commentStart >= 0 && (lines[commentStart].trim().startsWith('*') || lines[commentStart].trim().startsWith('/**') || lines[commentStart].trim() === '')) {
      commentStart--;
    }
    startLine = commentStart + 1;
    inMoveBefore = true;
  }

  // Detect start of moveAfter method
  if (line.trim().startsWith('moveAfter(')) {
    startLine = i;
    let commentStart = i - 1;
    while (commentStart >= 0 && (lines[commentStart].trim().startsWith('*') || lines[commentStart].trim().startsWith('/**') || lines[commentStart].trim() === '')) {
      commentStart--;
    }
    startLine = commentStart + 1;
    inMoveAfter = true;
  }

  // Detect end of method (closing brace at same indentation level)
  if ((inMoveInside || inMoveBefore || inMoveAfter) && line.trim() === '}' && !line.startsWith('    }')) {
    endLine = i;
    linesToRemove.push({ start: startLine, end: endLine });
    inMoveInside = false;
    inMoveBefore = false;
    inMoveAfter = false;
  }
}

console.log('Lines to remove:', linesToRemove);

// Create new content by removing these line ranges
let newLines = [];
let currentLine = 0;

for (const range of linesToRemove) {
  // Add lines before this range
  newLines.push(...lines.slice(currentLine, range.start));
  // Skip the lines in this range
  currentLine = range.end + 1;
}

// Add remaining lines
newLines.push(...lines.slice(currentLine));

// Write the result
fs.writeFileSync(filePath, newLines.join('\n'), 'utf-8');

console.log(`Refactored JSXTransformer: removed ${linesToRemove.length} methods`);
console.log(`New line count: ${newLines.length} (was ${lines.length})`);
