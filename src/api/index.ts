/**
 * Public API Module
 *
 * This module contains all public-facing API functions for regrafter.
 * All implementations are organized by function to improve maintainability.
 *
 * @module api
 */

// Core transformation APIs
export { regraft } from './regraft.js';
export { canMove, move } from './move.js';
export { analyze } from './analyze.js';
export { optimize } from './optimize.js';
export { inline, type InlineResult, type Component } from './inline.js';

// API types
export { type TransformedCode } from './types.js';
export {
  createSuccessResult,
  createErrorResult,
  createErrorFromRegraffError,
  createErrorFromException,
} from './result-helpers.js';
