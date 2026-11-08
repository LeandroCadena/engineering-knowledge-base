import { StrictMode, useActionState, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';

type Order = { id: string; customer: string; status: string };
type Load = { rows: Order[]; status: 'loading' | 'ready' | 'error'; error: string };
function readOrders(value: unknown): Order[] {
  if (
    !Array.isArray(value) ||
    value.some(
      (row) =>
        !row ||
        typeof row.id !== 'string' ||
        typeof row.customer !== 'string' ||
        typeof row.status !== 'string',
    )
  )
    throw new Error('Invalid orders response');
  if (new Set(value.map((row) => row.id)).size !== value.length)
    throw new Error('Duplicate order IDs');
  return value;
}
function useOrders(query: string) {
  const [state, setState] = useState<Load>({ rows: [], status: 'loading', error: '' });
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setState((previous) => ({ ...previous, status: 'loading', error: '' }));
    fetch(`/api/orders?q=${encodeURIComponent(query)}`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('Orders unavailable');
        return response.json();
      })
      .then(readOrders)
      .then((rows) => {
        if (active) setState({ rows, status: 'ready', error: '' });
      })
      .catch((error) => {
        if (active && error.name !== 'AbortError')
          setState((previous) => ({ ...previous, status: 'error', error: 'Orders unavailable' }));
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [query]);
  return state;
}
function OrderRow({ order }: { order: Order }) {
  const [note, setNote] = useState('');
  const [result, submit, pending] = useActionState(
    async (_previous: { error: string; message: string }, data: FormData) => {
      const text = String(data.get('note') ?? '').trim();
      if (!text || text.length > 200)
        return { error: 'Enter a note of 1–200 characters.', message: '' };
      try {
        const response = await fetch('/api/notes', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ id: order.id, note: text }),
        });
        if (!response.ok) throw new Error('Save failed');
        setNote('');
        return { error: '', message: 'Note saved.' };
      } catch {
        return { error: 'Save failed. Your draft is retained.', message: '' };
      }
    },
    { error: '', message: '' },
  );
  return (
    <li data-order-id={order.id}>
      <h2>
        {order.id} · {order.customer}
      </h2>
      <p>{order.status}</p>
      <form action={submit}>
        <label htmlFor={`note-${order.id}`}>Note for {order.id}</label>
        <input
          id={`note-${order.id}`}
          name="note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          disabled={pending}
        />
        <button disabled={pending}>{pending ? 'Saving…' : 'Save note'}</button>
        {result.error && <p role="alert">{result.error}</p>}
        <p role="status">{result.message}</p>
      </form>
    </li>
  );
}
function App() {
  const [query, setQuery] = useState('');
  const [descending, setDescending] = useState(false);
  const [count, setCount] = useState(0);
  const state = useOrders(query);
  const rows = [...state.rows].sort((a, b) =>
    descending ? b.id.localeCompare(a.id) : a.id.localeCompare(b.id),
  );
  return (
    <main>
      <h1>Orders</h1>
      <p>Local reading example: fixture data and in-memory notes.</p>
      <label htmlFor="search">Search customers</label>
      <input id="search" value={query} onChange={(event) => setQuery(event.target.value)} />
      <button type="button" onClick={() => setDescending((value) => !value)}>
        Reverse order
      </button>
      <button
        type="button"
        onClick={() => {
          setCount((n) => n + 1);
          setCount((n) => n + 1);
          setCount((n) => n + 1);
        }}
      >
        Add three
      </button>
      <output aria-label="Queued count">{count}</output>
      <p role="status">
        {state.status === 'loading' ? 'Loading orders…' : `${rows.length} orders`}
      </p>
      {state.error && <p role="alert">{state.error}</p>}
      <ul aria-label="Order results">
        {rows.map((order) => (
          <OrderRow key={order.id} order={order} />
        ))}
      </ul>
    </main>
  );
}
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
