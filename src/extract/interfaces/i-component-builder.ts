/**
 * IComponentBuilder interface
 *
 * Builds a new component from an extraction plan
 */

import type * as t from '@babel/types';

import type { ExtractPlan } from '../types.js';

export interface IComponentBuilder {
  /**
   * Build a new component from an extraction plan
   *
   * @param plan - Extraction plan
   * @returns AST for the new component file
   */
  build(plan: ExtractPlan): t.File;
}
