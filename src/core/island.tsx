import React, { ComponentType, ReactNode } from 'react';
import { renderToString } from 'react-dom/server';
import { registerIslandInContext } from './island-registry.js';

let islandCounter = 0;

export interface IslandProps<P = Record<string, unknown>> {
  /** Explicit island name (optional) */
  name?: string;
  /** Path to the island component file (relative or absolute) */
  src?: string;
  /** The React component to render */
  component: ComponentType<P>;
  /** Props passed to the component */
  props?: P;
  /** Client hydration directive (default: 'load') */
  client?: 'load' | 'idle' | 'visible';
  /** Optional wrapper tag, default: 'div' */
  as?: string;
  className?: string;
  style?: React.CSSProperties;
  children?: ReactNode;
}

export function Island<P extends Record<string, unknown>>({
  name,
  src,
  component: Component,
  props = {} as P,
  client = 'load',
  as: Tag = 'div',
  className,
  style,
  children
}: IslandProps<P>): React.ReactElement {
  const componentName =
    name ||
    (Component as any).__islandName ||
    Component.displayName ||
    Component.name ||
    'AnonymousIsland';

  const islandId = `island-${++islandCounter}`;

  // If src is specified or attached to component
  const entryPath = src || (Component as any).__islandPath || '';

  registerIslandInContext({
    id: islandId,
    name: componentName,
    entryPath,
    props,
    clientDirective: client
  });

  const Wrapper = Tag as any;

  // Use renderToString for the island's inner tree to produce hydration-compatible SSR markup
  const innerHtml = renderToString(React.createElement(Component, props, children));

  return (
    <Wrapper
      data-island={componentName}
      data-island-id={islandId}
      data-props={JSON.stringify(props)}
      data-client={client}
      className={className}
      style={style}
      dangerouslySetInnerHTML={{ __html: `<!--__ISLAND_START__-->${innerHtml}<!--__ISLAND_END__-->` }}
    />
  );
}

/**
 * Helper to wrap any React component into a ready-to-use Island component
 * Example:
 *   export const Counter = island(CounterComponent, import.meta.url, 'Counter');
 *   // In page: <Counter initialCount={5} />
 */
export function island<P extends Record<string, unknown>>(
  Component: ComponentType<P>,
  sourcePath: string,
  customName?: string
): ComponentType<P & { client?: 'load' | 'idle' | 'visible'; as?: string; className?: string; style?: React.CSSProperties }> {
  const resolvedName = customName || Component.displayName || Component.name || 'AnonymousIsland';
  (Component as any).__islandPath = sourcePath;
  (Component as any).__islandName = resolvedName;

  const IslandWrapper = (props: P & { client?: 'load' | 'idle' | 'visible'; as?: string; className?: string; style?: React.CSSProperties }) => {
    const { client, as, className, style, ...componentProps } = props;
    return (
      <Island
        name={resolvedName}
        src={sourcePath}
        component={Component}
        props={componentProps as P}
        client={client}
        as={as}
        className={className}
        style={style}
      />
    );
  };

  IslandWrapper.displayName = `Island(${resolvedName})`;
  (IslandWrapper as any).__islandPath = sourcePath;
  (IslandWrapper as any).__islandName = resolvedName;
  (IslandWrapper as any).__rawComponent = Component;
  return IslandWrapper;
}
