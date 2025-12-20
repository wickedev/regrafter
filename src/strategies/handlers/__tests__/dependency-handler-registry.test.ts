/**
 * Tests for DependencyHandlerRegistry
 */

import { describe, it, expect, beforeEach } from 'vitest';

import { DependencyType } from '../../../types/public.js';
import {
  DependencyHandlerRegistry,
  createDependencyHandlerRegistry,
} from '../dependency-handler-registry.js';
import type { IDependencyHandler } from '../dependency-handler.js';
import { HookDependencyHandler } from '../hook-dependency-handler.js';
import { VariableDependencyHandler } from '../variable-dependency-handler.js';
import { PropDependencyHandler } from '../prop-dependency-handler.js';
import { ImportDependencyHandler } from '../import-dependency-handler.js';

describe('DependencyHandlerRegistry', () => {
  let registry: DependencyHandlerRegistry;

  beforeEach(() => {
    registry = new DependencyHandlerRegistry();
  });

  describe('register', () => {
    it('should register a handler', () => {
      const mockHandler: IDependencyHandler = {
        getName: () => DependencyType.Hook,
        plan: () => null,
        execute: () => ({ ok: true, value: undefined }),
      };

      registry.register(mockHandler);

      expect(registry.hasHandler(DependencyType.Hook)).toBe(true);
      expect(registry.size).toBe(1);
    });

    it('should replace existing handler for the same type', () => {
      const handler1: IDependencyHandler = {
        getName: () => DependencyType.Hook,
        plan: () => null,
        execute: () => ({ ok: true, value: undefined }),
      };

      const handler2: IDependencyHandler = {
        getName: () => DependencyType.Hook,
        plan: () => null,
        execute: () => ({ ok: true, value: undefined }),
      };

      registry.register(handler1);
      registry.register(handler2);

      expect(registry.size).toBe(1);
      expect(registry.getHandler(DependencyType.Hook)).toBe(handler2);
    });
  });

  describe('getHandler', () => {
    it('should return registered handler', () => {
      const mockHandler: IDependencyHandler = {
        getName: () => DependencyType.Variable,
        plan: () => null,
        execute: () => ({ ok: true, value: undefined }),
      };

      registry.register(mockHandler);

      const handler = registry.getHandler(DependencyType.Variable);

      expect(handler).toBe(mockHandler);
    });

    it('should return null for unregistered handler', () => {
      const handler = registry.getHandler(DependencyType.Hook);

      expect(handler).toBeNull();
    });
  });

  describe('getAllHandlers', () => {
    it('should return empty array when no handlers registered', () => {
      const handlers = registry.getAllHandlers();

      expect(handlers).toEqual([]);
    });

    it('should return all registered handlers', () => {
      const handler1: IDependencyHandler = {
        getName: () => DependencyType.Hook,
        plan: () => null,
        execute: () => ({ ok: true, value: undefined }),
      };

      const handler2: IDependencyHandler = {
        getName: () => DependencyType.Variable,
        plan: () => null,
        execute: () => ({ ok: true, value: undefined }),
      };

      registry.register(handler1);
      registry.register(handler2);

      const handlers = registry.getAllHandlers();

      expect(handlers).toHaveLength(2);
      expect(handlers).toContain(handler1);
      expect(handlers).toContain(handler2);
    });
  });

  describe('hasHandler', () => {
    it('should return true for registered handler', () => {
      const mockHandler: IDependencyHandler = {
        getName: () => DependencyType.Prop,
        plan: () => null,
        execute: () => ({ ok: true, value: undefined }),
      };

      registry.register(mockHandler);

      expect(registry.hasHandler(DependencyType.Prop)).toBe(true);
    });

    it('should return false for unregistered handler', () => {
      expect(registry.hasHandler(DependencyType.Import)).toBe(false);
    });
  });

  describe('unregister', () => {
    it('should unregister a handler', () => {
      const mockHandler: IDependencyHandler = {
        getName: () => DependencyType.Hook,
        plan: () => null,
        execute: () => ({ ok: true, value: undefined }),
      };

      registry.register(mockHandler);
      expect(registry.hasHandler(DependencyType.Hook)).toBe(true);

      const result = registry.unregister(DependencyType.Hook);

      expect(result).toBe(true);
      expect(registry.hasHandler(DependencyType.Hook)).toBe(false);
      expect(registry.size).toBe(0);
    });

    it('should return false when unregistering non-existent handler', () => {
      const result = registry.unregister(DependencyType.Variable);

      expect(result).toBe(false);
    });
  });

  describe('clear', () => {
    it('should clear all handlers', () => {
      const handler1: IDependencyHandler = {
        getName: () => DependencyType.Hook,
        plan: () => null,
        execute: () => ({ ok: true, value: undefined }),
      };

      const handler2: IDependencyHandler = {
        getName: () => DependencyType.Variable,
        plan: () => null,
        execute: () => ({ ok: true, value: undefined }),
      };

      registry.register(handler1);
      registry.register(handler2);
      expect(registry.size).toBe(2);

      registry.clear();

      expect(registry.size).toBe(0);
      expect(registry.getAllHandlers()).toEqual([]);
    });
  });

  describe('size', () => {
    it('should return correct count of registered handlers', () => {
      expect(registry.size).toBe(0);

      const handler1: IDependencyHandler = {
        getName: () => DependencyType.Hook,
        plan: () => null,
        execute: () => ({ ok: true, value: undefined }),
      };

      registry.register(handler1);
      expect(registry.size).toBe(1);

      const handler2: IDependencyHandler = {
        getName: () => DependencyType.Variable,
        plan: () => null,
        execute: () => ({ ok: true, value: undefined }),
      };

      registry.register(handler2);
      expect(registry.size).toBe(2);
    });
  });

  describe('createDependencyHandlerRegistry', () => {
    it('should create registry with provided handlers', () => {
      const handlers: IDependencyHandler[] = [
        {
          getName: () => DependencyType.Hook,
          plan: () => null,
          execute: () => ({ ok: true, value: undefined }),
        },
        {
          getName: () => DependencyType.Variable,
          plan: () => null,
          execute: () => ({ ok: true, value: undefined }),
        },
      ];

      const registry = createDependencyHandlerRegistry(handlers);

      expect(registry.size).toBe(2);
      expect(registry.hasHandler(DependencyType.Hook)).toBe(true);
      expect(registry.hasHandler(DependencyType.Variable)).toBe(true);
    });

    it('should create empty registry when no handlers provided', () => {
      const registry = createDependencyHandlerRegistry([]);

      expect(registry.size).toBe(0);
    });
  });
});
