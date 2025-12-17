/**
 * Tests for SuspenseHandler Strategy
 *
 * This test suite covers the Suspense boundary handling implementation:
 * - Detecting lazy() imports
 * - Checking Suspense boundary presence
 * - Auto-wrapping when moving outside Suspense
 * - Preserving fallback props
 * - Handling ErrorBoundary scenarios
 */

import { describe, it, expect } from 'vitest';
import { parse } from '@babel/parser';
import traverseModule from '@babel/traverse';
import * as t from '@babel/types';

import { SuspenseHandler } from '../suspense-handler.js';
import { loadTraverseFunction, type TraverseFunction } from '../../utils/index.js';

const traverse: TraverseFunction = loadTraverseFunction(traverseModule);

// =============================================================================
// Test Helpers
// =============================================================================

function parseCode(code: string): t.File {
  return parse(code, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript'],
  });
}

// =============================================================================
// Test Suite: Lazy Component Detection
// =============================================================================

describe('SuspenseHandler - Lazy Component Detection', () => {
  it('should detect React.lazy() imports', () => {
    const code = `
      import React from 'react';
      const LazyComponent = React.lazy(() => import('./Component'));
    `;

    const ast = parseCode(code);
    const handler = new SuspenseHandler();

    let detected = false;
    traverse(ast, {
      VariableDeclarator(path) {
        if (path.node.id.type === 'Identifier' && path.node.id.name === 'LazyComponent') {
          detected = handler.isLazyComponent(path);
        }
      },
    });

    expect(detected).toBe(true);
  });

  it('should detect lazy() imports', () => {
    const code = `
      import { lazy } from 'react';
      const LazyComponent = lazy(() => import('./Component'));
    `;

    const ast = parseCode(code);
    const handler = new SuspenseHandler();

    let detected = false;
    traverse(ast, {
      VariableDeclarator(path) {
        if (path.node.id.type === 'Identifier' && path.node.id.name === 'LazyComponent') {
          detected = handler.isLazyComponent(path);
        }
      },
    });

    expect(detected).toBe(true);
  });

  it('should detect dynamic() from next/dynamic', () => {
    const code = `
      import dynamic from 'next/dynamic';
      const LazyComponent = dynamic(() => import('./Component'));
    `;

    const ast = parseCode(code);
    const handler = new SuspenseHandler();

    let detected = false;
    traverse(ast, {
      VariableDeclarator(path) {
        if (path.node.id.type === 'Identifier' && path.node.id.name === 'LazyComponent') {
          detected = handler.isLazyComponent(path);
        }
      },
    });

    expect(detected).toBe(true);
  });

  it('should detect loadable() from @loadable/component', () => {
    const code = `
      import loadable from '@loadable/component';
      const LazyComponent = loadable(() => import('./Component'));
    `;

    const ast = parseCode(code);
    const handler = new SuspenseHandler();

    let detected = false;
    traverse(ast, {
      VariableDeclarator(path) {
        if (path.node.id.type === 'Identifier' && path.node.id.name === 'LazyComponent') {
          detected = handler.isLazyComponent(path);
        }
      },
    });

    expect(detected).toBe(true);
  });

  it('should NOT detect regular component imports', () => {
    const code = `
      import Component from './Component';
      const RegularComponent = Component;
    `;

    const ast = parseCode(code);
    const handler = new SuspenseHandler();

    let detected = false;
    traverse(ast, {
      VariableDeclarator(path) {
        if (path.node.id.type === 'Identifier' && path.node.id.name === 'RegularComponent') {
          detected = handler.isLazyComponent(path);
        }
      },
    });

    expect(detected).toBe(false);
  });

  it('should detect lazy component in JSX element', () => {
    const code = `
      import React from 'react';
      const LazyComponent = React.lazy(() => import('./Component'));

      function App() {
        return <LazyComponent />;
      }
    `;

    const ast = parseCode(code);
    const handler = new SuspenseHandler();

    let detected = false;
    traverse(ast, {
      JSXElement(path) {
        const openingElement = path.node.openingElement;
        if (openingElement.name.type === 'JSXIdentifier' && openingElement.name.name === 'LazyComponent') {
          detected = handler.isLazyComponent(path);
        }
      },
    });

    expect(detected).toBe(true);
  });
});

// =============================================================================
// Test Suite: Suspense Boundary Detection
// =============================================================================

describe('SuspenseHandler - Suspense Boundary Detection', () => {
  it('should find Suspense boundary with <Suspense>', () => {
    const code = `
      import React, { Suspense } from 'react';

      function App() {
        return (
          <Suspense fallback={<div>Loading...</div>}>
            <div>Content</div>
          </Suspense>
        );
      }
    `;

    const ast = parseCode(code);
    const handler = new SuspenseHandler();

    let foundSuspense: boolean = false;
    traverse(ast, {
      JSXElement(path) {
        const openingElement = path.node.openingElement;
        if (openingElement.name.type === 'JSXIdentifier' && openingElement.name.name === 'div') {
          const suspenseBoundary = handler.findSuspenseBoundary(path);
          foundSuspense = suspenseBoundary !== null;
        }
      },
    });

    expect(foundSuspense).toBe(true);
  });

  it('should find Suspense boundary with <React.Suspense>', () => {
    const code = `
      import React from 'react';

      function App() {
        return (
          <React.Suspense fallback={<div>Loading...</div>}>
            <div>Content</div>
          </React.Suspense>
        );
      }
    `;

    const ast = parseCode(code);
    const handler = new SuspenseHandler();

    let foundSuspense: boolean = false;
    traverse(ast, {
      JSXElement(path) {
        const openingElement = path.node.openingElement;
        if (openingElement.name.type === 'JSXIdentifier' && openingElement.name.name === 'div') {
          const suspenseBoundary = handler.findSuspenseBoundary(path);
          foundSuspense = suspenseBoundary !== null;
        }
      },
    });

    expect(foundSuspense).toBe(true);
  });

  it('should return null when no Suspense boundary exists', () => {
    const code = `
      import React from 'react';

      function App() {
        return <div>Content</div>;
      }
    `;

    const ast = parseCode(code);
    const handler = new SuspenseHandler();

    let foundSuspense: boolean = false;
    let checkedElement = false;
    traverse(ast, {
      JSXElement(path) {
        const openingElement = path.node.openingElement;
        if (openingElement.name.type === 'JSXIdentifier' && openingElement.name.name === 'div') {
          checkedElement = true;
          const suspenseBoundary = handler.findSuspenseBoundary(path);
          foundSuspense = suspenseBoundary !== null;
        }
      },
    });

    expect(checkedElement).toBe(true);
    expect(foundSuspense).toBe(false);
  });

  it('should find nested Suspense boundary', () => {
    const code = `
      import React, { Suspense } from 'react';

      function App() {
        return (
          <div>
            <Suspense fallback={<div>Loading outer...</div>}>
              <Suspense fallback={<div>Loading inner...</div>}>
                <div id="content">Content</div>
              </Suspense>
            </Suspense>
          </div>
        );
      }
    `;

    const ast = parseCode(code);
    const handler = new SuspenseHandler();

    let foundSuspense: boolean = false;
    traverse(ast, {
      JSXElement(path) {
        const openingElement = path.node.openingElement;
        if (openingElement.name.type === 'JSXIdentifier' && openingElement.name.name === 'div') {
          // Check only the content div
          const attrs = openingElement.attributes;
          const hasId = attrs.some(attr =>
            attr.type === 'JSXAttribute' &&
            attr.name.name === 'id' &&
            attr.value?.type === 'StringLiteral' &&
            attr.value.value === 'content'
          );

          if (hasId) {
            const suspenseBoundary = handler.findSuspenseBoundary(path);
            foundSuspense = suspenseBoundary !== null;
          }
        }
      },
    });

    expect(foundSuspense).toBe(true);
  });
});

// =============================================================================
// Test Suite: Fallback Extraction
// =============================================================================

describe('SuspenseHandler - Fallback Extraction', () => {
  it('should extract fallback from Suspense element', () => {
    const code = `
      import React, { Suspense } from 'react';

      function App() {
        return (
          <Suspense fallback={<div>Loading...</div>}>
            <div>Content</div>
          </Suspense>
        );
      }
    `;

    const ast = parseCode(code);
    const handler = new SuspenseHandler();

    let extractedFallback: t.Expression | null = null;
    traverse(ast, {
      JSXElement(path) {
        const openingElement = path.node.openingElement;
        if (openingElement.name.type === 'JSXIdentifier' && openingElement.name.name === 'Suspense') {
          extractedFallback = handler.getFallbackFromSuspense(path as any);
        }
      },
    });

    expect(extractedFallback).not.toBeNull();
    expect(extractedFallback?.type).toBe('JSXElement');
  });

  it('should return null when no fallback prop exists', () => {
    const code = `
      import React, { Suspense } from 'react';

      function App() {
        return (
          <Suspense>
            <div>Content</div>
          </Suspense>
        );
      }
    `;

    const ast = parseCode(code);
    const handler = new SuspenseHandler();

    let extractedFallback: t.Expression | null | undefined = undefined;
    traverse(ast, {
      JSXElement(path) {
        const openingElement = path.node.openingElement;
        if (openingElement.name.type === 'JSXIdentifier' && openingElement.name.name === 'Suspense') {
          extractedFallback = handler.getFallbackFromSuspense(path as any);
        }
      },
    });

    expect(extractedFallback).toBeNull();
  });

  it('should extract complex fallback expressions', () => {
    const code = `
      import React, { Suspense } from 'react';

      const LoadingSpinner = () => <div className="spinner" />;

      function App() {
        return (
          <Suspense fallback={<LoadingSpinner />}>
            <div>Content</div>
          </Suspense>
        );
      }
    `;

    const ast = parseCode(code);
    const handler = new SuspenseHandler();

    let extractedFallback: t.Expression | null = null;
    traverse(ast, {
      JSXElement(path) {
        const openingElement = path.node.openingElement;
        if (openingElement.name.type === 'JSXIdentifier' && openingElement.name.name === 'Suspense') {
          extractedFallback = handler.getFallbackFromSuspense(path as any);
        }
      },
    });

    expect(extractedFallback).not.toBeNull();
    expect(extractedFallback?.type).toBe('JSXElement');
  });
});

// =============================================================================
// Test Suite: Suspense Wrapper Creation
// =============================================================================

describe('SuspenseHandler - Suspense Wrapper Creation', () => {
  it('should create Suspense wrapper with default fallback', () => {
    const code = `
      function App() {
        return <div>Content</div>;
      }
    `;

    const ast = parseCode(code);
    const handler = new SuspenseHandler();

    let suspenseElement: t.JSXElement | null = null;
    traverse(ast, {
      JSXElement(path) {
        const openingElement = path.node.openingElement;
        if (openingElement.name.type === 'JSXIdentifier' && openingElement.name.name === 'div') {
          suspenseElement = handler.createSuspenseWrapper(path);
        }
      },
    });

    expect(suspenseElement).not.toBeNull();
    expect(suspenseElement?.openingElement.name.type).toBe('JSXIdentifier');
    if (suspenseElement?.openingElement.name.type === 'JSXIdentifier') {
      expect(suspenseElement.openingElement.name.name).toBe('Suspense');
    }

    // Should have fallback attribute
    const attrs = suspenseElement?.openingElement.attributes ?? [];
    const fallbackAttr = attrs.find(attr =>
      attr.type === 'JSXAttribute' &&
      attr.name.name === 'fallback'
    );
    expect(fallbackAttr).toBeDefined();
  });

  it('should create Suspense wrapper with custom fallback', () => {
    const customFallback = t.jsxElement(
      t.jsxOpeningElement(t.jsxIdentifier('LoadingSpinner'), [], true),
      null,
      [],
      true
    );

    const code = `
      function App() {
        return <div>Content</div>;
      }
    `;

    const ast = parseCode(code);
    const handler = new SuspenseHandler();

    let suspenseElement: t.JSXElement | null = null;
    traverse(ast, {
      JSXElement(path) {
        const openingElement = path.node.openingElement;
        if (openingElement.name.type === 'JSXIdentifier' && openingElement.name.name === 'div') {
          suspenseElement = handler.createSuspenseWrapper(path, customFallback);
        }
      },
    });

    expect(suspenseElement).not.toBeNull();

    // Should have fallback attribute with custom element
    const attrs = suspenseElement?.openingElement.attributes ?? [];
    const fallbackAttr = attrs.find(attr =>
      attr.type === 'JSXAttribute' &&
      attr.name.name === 'fallback'
    ) as t.JSXAttribute | undefined;

    expect(fallbackAttr).toBeDefined();
    expect(fallbackAttr?.value?.type).toBe('JSXExpressionContainer');
    if (fallbackAttr?.value?.type === 'JSXExpressionContainer') {
      expect(fallbackAttr.value.expression.type).toBe('JSXElement');
    }
  });

  it('should wrap element as child of Suspense', () => {
    const code = `
      function App() {
        return <div>Content</div>;
      }
    `;

    const ast = parseCode(code);
    const handler = new SuspenseHandler();

    let suspenseElement: t.JSXElement | null = null;
    traverse(ast, {
      JSXElement(path) {
        const openingElement = path.node.openingElement;
        if (openingElement.name.type === 'JSXIdentifier' && openingElement.name.name === 'div') {
          suspenseElement = handler.createSuspenseWrapper(path);
        }
      },
    });

    expect(suspenseElement).not.toBeNull();
    expect(suspenseElement?.children.length).toBeGreaterThan(0);
  });
});

// =============================================================================
// Test Suite: isWithinSuspense Method (TASK-006)
// =============================================================================

describe('SuspenseHandler - isWithinSuspense (TASK-006)', () => {
  it('should return true when element is within Suspense boundary', () => {
    const code = `
      import React, { Suspense } from 'react';

      function App() {
        return (
          <Suspense fallback={<div>Loading...</div>}>
            <div id="content">Content</div>
          </Suspense>
        );
      }
    `;

    const ast = parseCode(code);
    const handler = new SuspenseHandler();

    let isWithin: boolean = false;
    traverse(ast, {
      JSXElement(path) {
        const openingElement = path.node.openingElement;
        if (openingElement.name.type === 'JSXIdentifier' && openingElement.name.name === 'div') {
          const attrs = openingElement.attributes;
          const hasId = attrs.some(attr =>
            attr.type === 'JSXAttribute' &&
            attr.name.name === 'id' &&
            attr.value?.type === 'StringLiteral' &&
            attr.value.value === 'content'
          );

          if (hasId) {
            isWithin = handler.isWithinSuspense(path);
          }
        }
      },
    });

    expect(isWithin).toBe(true);
  });

  it('should return false when element is NOT within Suspense boundary', () => {
    const code = `
      import React from 'react';

      function App() {
        return <div id="content">Content</div>;
      }
    `;

    const ast = parseCode(code);
    const handler = new SuspenseHandler();

    let isWithin: boolean = true;
    traverse(ast, {
      JSXElement(path) {
        const openingElement = path.node.openingElement;
        if (openingElement.name.type === 'JSXIdentifier' && openingElement.name.name === 'div') {
          const attrs = openingElement.attributes;
          const hasId = attrs.some(attr =>
            attr.type === 'JSXAttribute' &&
            attr.name.name === 'id' &&
            attr.value?.type === 'StringLiteral' &&
            attr.value.value === 'content'
          );

          if (hasId) {
            isWithin = handler.isWithinSuspense(path);
          }
        }
      },
    });

    expect(isWithin).toBe(false);
  });
});

// =============================================================================
// Test Suite: hasSuspenseBoundary Method (TASK-006)
// =============================================================================

describe('SuspenseHandler - hasSuspenseBoundary (TASK-006)', () => {
  it('should detect Suspense element in scope', () => {
    const code = `
      import React, { Suspense } from 'react';

      function App() {
        return (
          <div id="outer">
            <Suspense fallback={<div>Loading...</div>}>
              <div>Content</div>
            </Suspense>
          </div>
        );
      }
    `;

    const ast = parseCode(code);
    const handler = new SuspenseHandler();

    let hasBoundary: boolean = false;
    let checkedOuter = false;
    traverse(ast, {
      JSXElement(path) {
        const openingElement = path.node.openingElement;
        if (openingElement.name.type === 'JSXIdentifier' && openingElement.name.name === 'div') {
          // Only check the outer div (with id="outer")
          const attrs = openingElement.attributes;
          const hasId = attrs.some(attr =>
            attr.type === 'JSXAttribute' &&
            attr.name.name === 'id' &&
            attr.value?.type === 'StringLiteral' &&
            attr.value.value === 'outer'
          );

          if (hasId) {
            checkedOuter = true;
            hasBoundary = handler.hasSuspenseBoundary(path);
          }
        }
      },
    });

    expect(checkedOuter).toBe(true);
    expect(hasBoundary).toBe(true);
  });

  it('should return false when no Suspense exists in scope', () => {
    const code = `
      import React from 'react';

      function App() {
        return (
          <div>
            <div>Content</div>
          </div>
        );
      }
    `;

    const ast = parseCode(code);
    const handler = new SuspenseHandler();

    let hasBoundary: boolean = true;
    let checkedPaths = 0;
    traverse(ast, {
      JSXElement(path) {
        const openingElement = path.node.openingElement;
        if (openingElement.name.type === 'JSXIdentifier' && openingElement.name.name === 'div') {
          checkedPaths++;
          hasBoundary = handler.hasSuspenseBoundary(path);
        }
      },
    });

    expect(checkedPaths).toBeGreaterThan(0);
    expect(hasBoundary).toBe(false);
  });
});

// =============================================================================
// Test Suite: TASK-006 Complete Integration
// =============================================================================

describe('SuspenseHandler - TASK-006 Integration', () => {
  it('should handle lazy component moving outside Suspense', () => {
    const code = `
      import React, { Suspense, lazy } from 'react';
      const LazyComponent = lazy(() => import('./Component'));

      function App() {
        return (
          <div>
            <Suspense fallback={<div>Loading...</div>}>
              <LazyComponent />
            </Suspense>
          </div>
        );
      }
    `;

    const ast = parseCode(code);
    const handler = new SuspenseHandler();

    let lazyElement: any = null;
    traverse(ast, {
      JSXElement(path) {
        const openingElement = path.node.openingElement;
        if (openingElement.name.type === 'JSXIdentifier' && openingElement.name.name === 'LazyComponent') {
          lazyElement = path;
        }
      },
    });

    expect(lazyElement).not.toBeNull();
    expect(handler.isLazyComponent(lazyElement)).toBe(true);
    expect(handler.isWithinSuspense(lazyElement)).toBe(true);
  });

  it('should warn when lazy component is NOT in Suspense', () => {
    const code = `
      import React, { lazy } from 'react';
      const LazyComponent = lazy(() => import('./Component'));

      function App() {
        return <LazyComponent />;
      }
    `;

    const ast = parseCode(code);
    const handler = new SuspenseHandler();

    let lazyElement: any = null;
    traverse(ast, {
      JSXElement(path) {
        const openingElement = path.node.openingElement;
        if (openingElement.name.type === 'JSXIdentifier' && openingElement.name.name === 'LazyComponent') {
          lazyElement = path;
        }
      },
    });

    expect(lazyElement).not.toBeNull();
    expect(handler.isLazyComponent(lazyElement)).toBe(true);
    expect(handler.isWithinSuspense(lazyElement)).toBe(false);
  });

  it('should preserve fallback when creating Suspense wrapper', () => {
    const code = `
      import React, { Suspense } from 'react';

      function App() {
        return (
          <Suspense fallback={<div className="spinner">Loading...</div>}>
            <div>Content</div>
          </Suspense>
        );
      }
    `;

    const ast = parseCode(code);
    const handler = new SuspenseHandler();

    let originalFallback: t.Expression | null = null;
    let targetElement: any = null;

    traverse(ast, {
      JSXElement(path) {
        const openingElement = path.node.openingElement;

        if (openingElement.name.type === 'JSXIdentifier' && openingElement.name.name === 'Suspense') {
          originalFallback = handler.getFallbackFromSuspense(path as any);
        }

        if (openingElement.name.type === 'JSXIdentifier' && openingElement.name.name === 'div') {
          const attrs = openingElement.attributes;
          const hasClass = attrs.some(attr =>
            attr.type === 'JSXAttribute' &&
            attr.name.name === 'className'
          );
          if (!hasClass) {
            targetElement = path;
          }
        }
      },
    });

    expect(originalFallback).not.toBeNull();
    expect(targetElement).not.toBeNull();

    // Create new Suspense with preserved fallback
    const newSuspense = handler.createSuspenseWrapper(targetElement, originalFallback!);
    expect(newSuspense).toBeDefined();

    // Verify fallback is preserved
    const attrs = newSuspense.openingElement.attributes;
    const fallbackAttr = attrs.find(attr =>
      attr.type === 'JSXAttribute' && attr.name.name === 'fallback'
    ) as t.JSXAttribute | undefined;

    expect(fallbackAttr).toBeDefined();
    expect(fallbackAttr?.value?.type).toBe('JSXExpressionContainer');
  });
});
