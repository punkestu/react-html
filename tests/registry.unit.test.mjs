import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  runWithRenderContext,
  getCurrentRenderContext,
  registerIslandInContext
} from '../dist/core/island-registry.js';

describe('island-registry Unit Tests', () => {
  test('getCurrentRenderContext returns undefined when called outside context', () => {
    const ctx = getCurrentRenderContext();
    assert.equal(ctx, undefined);
  });

  test('runWithRenderContext scopes context correctly during execution', () => {
    const context = {
      pagePath: '/pages/index.tsx',
      islands: []
    };

    let capturedCtx = null;
    const result = runWithRenderContext(context, () => {
      capturedCtx = getCurrentRenderContext();
      return 'rendered';
    });

    assert.equal(result, 'rendered');
    assert.equal(capturedCtx, context);
    assert.equal(getCurrentRenderContext(), undefined, 'Context must be cleared after execution');
  });

  test('registerIslandInContext appends island instance to active context', () => {
    const context = {
      pagePath: '/pages/counter.tsx',
      islands: []
    };

    runWithRenderContext(context, () => {
      registerIslandInContext({
        id: 'island-1',
        name: 'Counter',
        entryPath: '/components/Counter.tsx',
        props: { initial: 1 }
      });

      registerIslandInContext({
        id: 'island-2',
        name: 'Header',
        entryPath: '/components/Header.tsx',
        props: {}
      });
    });

    assert.equal(context.islands.length, 2);
    assert.equal(context.islands[0].name, 'Counter');
    assert.deepEqual(context.islands[0].props, { initial: 1 });
    assert.equal(context.islands[1].name, 'Header');
  });

  test('registerIslandInContext is a safe no-op outside of context', () => {
    assert.doesNotThrow(() => {
      registerIslandInContext({
        id: 'island-orphan',
        name: 'Orphan',
        entryPath: '/orphan.tsx',
        props: {}
      });
    });
  });

  test('supports nested contexts without leakage', () => {
    const outerContext = { pagePath: '/outer.tsx', islands: [] };
    const innerContext = { pagePath: '/inner.tsx', islands: [] };

    runWithRenderContext(outerContext, () => {
      registerIslandInContext({ id: 'out-1', name: 'Outer', entryPath: '/out.tsx', props: {} });

      runWithRenderContext(innerContext, () => {
        registerIslandInContext({ id: 'in-1', name: 'Inner', entryPath: '/in.tsx', props: {} });
      });

      assert.equal(getCurrentRenderContext()?.pagePath, '/outer.tsx');
    });

    assert.equal(outerContext.islands.length, 1);
    assert.equal(outerContext.islands[0].name, 'Outer');
    assert.equal(innerContext.islands.length, 1);
    assert.equal(innerContext.islands[0].name, 'Inner');
  });
});

