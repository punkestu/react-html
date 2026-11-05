import React, { ComponentType } from 'react';
import { hydrateRoot, createRoot } from 'react-dom/client';

export type ClientDirective = 'load' | 'idle' | 'visible';

export function hydrateIsland(
  islandName: string,
  Component: ComponentType<any>
): void {
  if (typeof window === 'undefined') return;

  const mountElements = document.querySelectorAll<HTMLElement>(`[data-island="${islandName}"]`);

  mountElements.forEach((el) => {
    // Prevent double hydration
    if (el.hasAttribute('data-hydrated')) return;

    const rawProps = el.getAttribute('data-props');
    let props: Record<string, unknown> = {};
    if (rawProps) {
      try {
        props = JSON.parse(rawProps);
      } catch (err) {
        console.error(`[react-html] Failed to parse props for island "${islandName}":`, err);
      }
    }

    const directive = (el.getAttribute('data-client') || 'load') as ClientDirective;

    const doHydrate = () => {
      if (el.hasAttribute('data-hydrated')) return;
      el.setAttribute('data-hydrated', 'true');

      try {
        hydrateRoot(el, React.createElement(Component, props), {
          onRecoverableError(error) {
            // Suppress non-breaking hydration difference warnings
            console.debug(`[react-html] Island "${islandName}" hydration note:`, error);
          }
        });
      } catch (err) {
        console.warn(`[react-html] Hydration error on island "${islandName}", recovering with client mount:`, err);
        const root = createRoot(el);
        root.render(React.createElement(Component, props));
      }
    };

    switch (directive) {
      case 'idle': {
        if ('requestIdleCallback' in window) {
          (window as any).requestIdleCallback(doHydrate);
        } else {
          setTimeout(doHydrate, 200);
        }
        break;
      }
      case 'visible': {
        if ('IntersectionObserver' in window) {
          const observer = new IntersectionObserver((entries, obs) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting) {
                obs.disconnect();
                doHydrate();
              }
            });
          });
          observer.observe(el);
        } else {
          doHydrate();
        }
        break;
      }
      case 'load':
      default: {
        if (document.readyState === 'loading') {
          window.addEventListener('DOMContentLoaded', doHydrate, { once: true });
        } else {
          doHydrate();
        }
        break;
      }
    }
  });
}
