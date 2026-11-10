import React from 'react';

export interface VanillaCounterProps {
  initialCount?: number;
  step?: number;
}

// 1. SSR: Render modular pure HTML via React JSX
export default function VanillaCounter({ initialCount = 0, step = 1 }: VanillaCounterProps) {
  return (
    <div className="counter-box" style={{ borderColor: '#22c55e' }}>
      <h3 style={{ color: '#22c55e' }}>⚡ Pure Vanilla DOM Island</h3>
      <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>
        Rendered to HTML with React JSX, but hydrated with <strong>pure native JavaScript (0 KB React/VDOM runtime)</strong>!
      </p>
      <div className="counter-value" style={{ color: '#22c55e' }}>{initialCount}</div>
      <div className="btn-group">
        <button type="button" data-action="dec">
          - {step}
        </button>
        <button type="button" data-action="reset">
          Reset
        </button>
        <button type="button" data-action="inc">
          + {step}
        </button>
      </div>
    </div>
  );
}

// 2. Client: Pure native DOM controller (Zero React, Zero Preact, ~180 bytes total!)
export function client(el: HTMLElement, props: VanillaCounterProps) {
  let count = props.initialCount || 0;
  const step = props.step || 1;
  const valueEl = el.querySelector<HTMLElement>('.counter-value');

  el.querySelector('[data-action="dec"]')?.addEventListener('click', () => {
    count -= step;
    if (valueEl) valueEl.textContent = String(count);
  });

  el.querySelector('[data-action="reset"]')?.addEventListener('click', () => {
    count = 0;
    if (valueEl) valueEl.textContent = '0';
  });

  el.querySelector('[data-action="inc"]')?.addEventListener('click', () => {
    count += step;
    if (valueEl) valueEl.textContent = String(count);
  });
}

