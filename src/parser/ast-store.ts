/**
 * AST Store - Caching mechanism for parsed ASTs
 *
 * Provides content hash-based cache validation to avoid
 * reparsing unchanged files.
 */

import type { File as BabelFile } from '@babel/types';

import type { Result } from '../result/index.js';
import type { ParseErrorType } from '../errors/error-category.js';

/**
 * Entry in the AST cache
 */
interface ASTCacheEntry {
  /** The parsed AST */
  ast: BabelFile;
  /** Hash of the source content for validation */
  contentHash: string;
  /** Timestamp when entry was created */
  timestamp: number;
  /** The original parse result */
  result: Result<BabelFile, ParseErrorType>;
}

/**
 * Simple string hash function using djb2 algorithm
 * Good enough for cache invalidation purposes
 */
function hashString(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  // Convert to unsigned 32-bit integer and then to hex string
  return (hash >>> 0).toString(16);
}

/**
 * AST Store for caching parsed ASTs
 *
 * Uses content hashing to validate cache entries and avoid
 * returning stale ASTs when file content has changed.
 */
export class ASTStore {
  private readonly cache: Map<string, ASTCacheEntry> = new Map();

  /**
   * Get a cached parse result for a file
   * @param filename - File path to look up
   * @param content - Current content for hash validation
   * @returns Cached Result if valid, undefined otherwise
   */
  get(filename: string, content: string): Result<BabelFile, ParseErrorType> | undefined {
    const entry = this.cache.get(filename);
    if (!entry) {
      return undefined;
    }

    // Validate content hash
    const currentHash = hashString(content);
    if (entry.contentHash !== currentHash) {
      // Content changed, invalidate cache
      this.cache.delete(filename);
      return undefined;
    }

    return entry.result;
  }

  /**
   * Store a parse result in the cache
   * @param filename - File path as cache key
   * @param content - Source content for hash generation
   * @param result - Parse result to cache
   */
  set(filename: string, content: string, result: Result<BabelFile, ParseErrorType>): void {
    // Only cache successful parses with valid ASTs
    if (!result.ok) {
      return;
    }

    const entry: ASTCacheEntry = {
      ast: result.value,
      contentHash: hashString(content),
      timestamp: Date.now(),
      result,
    };

    this.cache.set(filename, entry);
  }

  /**
   * Check if a file is in the cache (regardless of validity)
   * @param filename - File path to check
   */
  has(filename: string): boolean {
    return this.cache.has(filename);
  }

  /**
   * Invalidate cache for a specific file
   * @param filename - File path to invalidate
   */
  invalidate(filename: string): void {
    this.cache.delete(filename);
  }

  /**
   * Clear all cached entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get the number of cached entries
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Get all cached file paths
   */
  keys(): IterableIterator<string> {
    return this.cache.keys();
  }
}

/**
 * Compute hash for content (exposed for testing)
 */
export function computeContentHash(content: string): string {
  return hashString(content);
}
