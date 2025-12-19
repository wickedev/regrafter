/**
 * Regraft API (Deprecated)
 *
 * This is now an alias to move() for backward compatibility.
 * Please use move() directly in new code.
 *
 * @deprecated Use move() instead
 * @module api/regraft
 */

import { move } from './move.js';

/**
 * Main entry point for the regraft operation.
 *
 * **DEPRECATED**: Use `move()` instead. This function is kept for backward compatibility.
 *
 * @deprecated Use move() instead
 * @see {@link move}
 */
export const regraft = move;
