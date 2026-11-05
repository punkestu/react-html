import { AsyncLocalStorage } from 'node:async_hooks';

export interface IslandInstance {
  id: string;
  name: string;
  entryPath: string;
  props: Record<string, unknown>;
  clientDirective?: 'load' | 'idle' | 'visible';
}

export interface RenderContext {
  pagePath: string;
  islands: IslandInstance[];
}

const GLOBAL_STORAGE_KEY = Symbol.for('__react_html_render_context__');

const storage: AsyncLocalStorage<RenderContext> =
  (globalThis as any)[GLOBAL_STORAGE_KEY] ||
  ((globalThis as any)[GLOBAL_STORAGE_KEY] = new AsyncLocalStorage<RenderContext>());

export function runWithRenderContext<T>(context: RenderContext, fn: () => T): T {
  return storage.run(context, fn);
}

export function getCurrentRenderContext(): RenderContext | undefined {
  return storage.getStore();
}

export function registerIslandInContext(island: IslandInstance): void {
  const ctx = storage.getStore();
  if (ctx) {
    ctx.islands.push(island);
  }
}
