import React, { ComponentType, ReactNode } from 'react';

export function Island<P extends Record<string, unknown>>({
  component: Component,
  props = {} as P,
  children
}: {
  component: ComponentType<P>;
  props?: P;
  children?: ReactNode;
  [key: string]: unknown;
}): React.ReactElement {
  return React.createElement(Component, props, children);
}

export function island<P extends Record<string, unknown>>(
  Component: ComponentType<P>,
  _sourcePath?: string,
  _customName?: string
): ComponentType<P> {
  return Component;
}

