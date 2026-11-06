import React, { useState } from 'react';

export interface CounterProps {
  initialCount?: number;
  step?: number;
}

export default function Counter({ initialCount = 0, step = 1 }: CounterProps) {
  const [count, setCount] = useState(initialCount);

  return (
    <div className="counter-box">
      <h3>⚡ Interactive Counter Island</h3>
      <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>
        This component is rendered statically on the server, then hydrated with tiny JavaScript.
      </p>
      <div className="counter-value">{count}</div>
      <div className="btn-group">
        <button type="button" onClick={() => setCount((c) => c - step)}>
          - {step}
        </button>
        <button type="button" onClick={() => setCount(0)}>
          Reset
        </button>
        <button type="button" onClick={() => setCount((c) => c + step)}>
          + {step}
        </button>
      </div>
    </div>
  );
}
