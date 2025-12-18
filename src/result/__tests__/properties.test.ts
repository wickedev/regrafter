/**
 * Property-based tests for Result type laws
 * Task 18.1: Test algebraic laws and properties of the Result type
 *
 * These tests use fast-check to verify that the Result type satisfies
 * mathematical laws (functor, monad laws) across many randomly generated inputs.
 */

import { describe, it, expect } from 'vitest';
import { fc, test } from '@fast-check/vitest';
import { ok, err, type Result } from '../types.js';
import { map, flatMap } from '../helpers.js';

describe('Result property-based tests - Task 18.1', () => {
  describe('Functor laws - map', () => {
    test.prop([fc.anything()])('map preserves Ok values (identity law)', (value) => {
      // Given an Ok result with any value
      const result: Result<unknown, string> = ok(value);

      // When we map with identity function
      const mapped = map(result, (x) => x);

      // Then the result should be unchanged
      expect(mapped.ok).toBe(true);
      if (mapped.ok) {
        expect(mapped.value).toEqual(value);
      }
    });

    test.prop([fc.integer(), fc.integer()])(
      'map composition law: map(f).map(g) === map(g ∘ f)',
      (n, m) => {
        // Given two functions
        const f = (x: number) => x + n;
        const g = (x: number) => x * m;

        // And an Ok result
        const result = ok(10);

        // When we compose maps
        const composedMaps = map(map(result, f), g);
        const singleMap = map(result, (x) => g(f(x)));

        // Then both should produce the same result
        expect(composedMaps).toEqual(singleMap);
      }
    );

    test.prop([fc.string()])('map does not affect Err values', (errorMsg) => {
      // Given an Err result
      const result: Result<number, string> = err(errorMsg);

      // When we map over it
      const mapped = map(result, (x) => x * 2);

      // Then it should remain unchanged
      expect(mapped.ok).toBe(false);
      if (!mapped.ok) {
        expect(mapped.error).toBe(errorMsg);
      }
    });
  });

  describe('Monad laws - flatMap', () => {
    test.prop([fc.integer()])(
      'left identity law: ok(a).flatMap(f) === f(a)',
      (value) => {
        // Given a value and a function that returns Result
        const f = (x: number): Result<number, string> => ok(x * 2);

        // When we wrap in ok and flatMap
        const leftSide = flatMap(ok(value), f);

        // And when we call f directly
        const rightSide = f(value);

        // Then they should be equal
        expect(leftSide).toEqual(rightSide);
      }
    );

    test.prop([fc.integer()])(
      'right identity law: result.flatMap(ok) === result',
      (value) => {
        // Given an Ok result
        const result = ok(value);

        // When we flatMap with ok constructor
        const flatMapped = flatMap(result, (x) => ok(x));

        // Then it should equal the original result
        expect(flatMapped).toEqual(result);
      }
    );

    test.prop([fc.integer()])(
      'associativity law: m.flatMap(f).flatMap(g) === m.flatMap(x => f(x).flatMap(g))',
      (n) => {
        // Given two functions that return Results
        const f = (x: number): Result<number, string> => ok(x + 1);
        const g = (x: number): Result<number, string> => ok(x * 2);

        // And an Ok result
        const m = ok(n);

        // When we chain flatMaps
        const leftSide = flatMap(flatMap(m, f), g);

        // And when we nest the flatMap
        const rightSide = flatMap(m, (x) => flatMap(f(x), g));

        // Then both should produce the same result
        expect(leftSide).toEqual(rightSide);
      }
    );
  });

  describe('Result construction and transformation equivalence', () => {
    test.prop([fc.integer()])(
      'ok(x).map(f) should equal ok(f(x))',
      (value) => {
        // Given a value and a transformation function
        const f = (x: number) => x * 3 + 7;

        // When we create Ok and then map
        const mappedResult = map(ok(value), f);

        // And when we transform first then create Ok
        const directResult = ok(f(value));

        // Then both should be equal
        expect(mappedResult).toEqual(directResult);
      }
    );

    test.prop([fc.string()])(
      'err(e).map(f) should equal err(e) (transformation is ignored)',
      (errorMsg) => {
        // Given an Err result and a transformation
        const result: Result<number, string> = err(errorMsg);
        const f = (x: number) => x * 100;

        // When we map over the error
        const mapped = map(result, f);

        // Then it should equal the original error
        expect(mapped).toEqual(result);
      }
    );
  });

  describe('Error short-circuiting', () => {
    test.prop([fc.string()])(
      'err() short-circuits map operations',
      (errorMsg) => {
        // Given an Err result
        const result: Result<number, string> = err(errorMsg);

        // When we chain multiple map operations
        let functionCalled = false;
        const mapped = map(
          map(
            map(result, (x) => {
              functionCalled = true;
              return x + 1;
            }),
            (x) => {
              functionCalled = true;
              return x * 2;
            }
          ),
          (x) => {
            functionCalled = true;
            return x - 3;
          }
        );

        // Then the functions should never be called
        expect(functionCalled).toBe(false);
        // And the error should propagate through
        expect(mapped.ok).toBe(false);
        if (!mapped.ok) {
          expect(mapped.error).toBe(errorMsg);
        }
      }
    );

    test.prop([fc.string()])(
      'err() short-circuits flatMap operations',
      (errorMsg) => {
        // Given an Err result
        const result: Result<number, string> = err(errorMsg);

        // When we chain multiple flatMap operations
        let functionCalled = false;
        const chained = flatMap(
          flatMap(result, (x) => {
            functionCalled = true;
            return ok(x + 1);
          }),
          (x) => {
            functionCalled = true;
            return ok(x * 2);
          }
        );

        // Then the functions should never be called
        expect(functionCalled).toBe(false);
        // And the error should propagate through
        expect(chained.ok).toBe(false);
        if (!chained.ok) {
          expect(chained.error).toBe(errorMsg);
        }
      }
    );

    test.prop([fc.integer(), fc.string()])(
      'first error in flatMap chain wins',
      (value, errorMsg) => {
        // Given a successful start
        const start = ok(value);

        // When we have a flatMap chain where the second operation fails
        const result = flatMap(
          flatMap(start, (x) => ok(x + 10)),
          (x) => err(errorMsg) // This error should propagate
        );

        // Then the error should be present
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error).toBe(errorMsg);
        }
      }
    );
  });

  describe('Type preservation properties', () => {
    test.prop([fc.integer()])(
      'map preserves the Result structure',
      (value) => {
        // Given an Ok result
        const result = ok(value);

        // When we map with any function
        const mapped = map(result, (x) => x.toString());

        // Then the result should still be an Ok variant
        expect(mapped.ok).toBe(true);
        expect(mapped).toHaveProperty('ok');
        if (mapped.ok) {
          expect(mapped).toHaveProperty('value');
        }
      }
    );

    test.prop([fc.string()])(
      'Err structure is preserved through transformations',
      (errorMsg) => {
        // Given an Err result
        const result: Result<number, string> = err(errorMsg);

        // When we apply transformations
        const transformed = flatMap(
          map(result, (x) => x * 2),
          (x) => ok(x + 1)
        );

        // Then it should still be an Err variant
        expect(transformed.ok).toBe(false);
        expect(transformed).toHaveProperty('ok');
        if (!transformed.ok) {
          expect(transformed).toHaveProperty('error');
        }
      }
    );
  });

  describe('Edge cases', () => {
    test.prop([fc.constant(null), fc.constant(undefined), fc.constant(0), fc.constant('')])(
      'map works with falsy values',
      (value) => {
        // Given an Ok result with a falsy value
        const result = ok(value);

        // When we map over it
        const mapped = map(result, (x) => x);

        // Then it should preserve the value
        expect(mapped.ok).toBe(true);
        if (mapped.ok) {
          expect(mapped.value).toBe(value);
        }
      }
    );

    test.prop([fc.object()])(
      'map works with complex objects',
      (obj) => {
        // Given an Ok result with an object
        const result = ok(obj);

        // When we map over it
        const mapped = map(result, (x) => ({ ...x, extra: 'field' }));

        // Then the transformation should be applied
        expect(mapped.ok).toBe(true);
        if (mapped.ok) {
          expect(mapped.value).toHaveProperty('extra', 'field');
        }
      }
    );

    test.prop([fc.array(fc.integer())])(
      'map works with arrays',
      (arr) => {
        // Given an Ok result with an array
        const result = ok(arr);

        // When we map over it
        const mapped = map(result, (x) => x.length);

        // Then it should transform correctly
        expect(mapped.ok).toBe(true);
        if (mapped.ok) {
          expect(mapped.value).toBe(arr.length);
        }
      }
    );
  });

  describe('Consistency between operations', () => {
    test.prop([fc.integer()])(
      'flatMap with ok constructor behaves like map',
      (value) => {
        // Given an Ok result
        const result = ok(value);
        const f = (x: number) => x * 2;

        // When we use map
        const mapped = map(result, f);

        // And when we use flatMap with ok constructor
        const flatMapped = flatMap(result, (x) => ok(f(x)));

        // Then they should produce the same result
        expect(mapped).toEqual(flatMapped);
      }
    );
  });
});
