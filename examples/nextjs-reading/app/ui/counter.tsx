'use client';
import { useState } from 'react';
export function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount((n) => n + 1)}>Local count: {count}</button>;
}
