/**
 * Selector Module
 *
 * Exports the SelectorResolver for resolving position and path-based selectors.
 */

export {
  SelectorResolver,
  createSelectorResolver,
} from './SelectorResolver.js';

export {
  SelectorErrorCodes,
  type SelectorErrorCode,
  type ISelectorResolver,
  type Selector,
  type PositionSelector,
  type PathSelector,
  type AtomicUnit,
  type SelectorError,
  type ResolveResult,
} from './types.js';
