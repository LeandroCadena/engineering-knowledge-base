'use client';
import { useActionState, useState } from 'react';
import { changeShipping } from '../actions';
export function ShippingForm({ label, version }: { label: string; version: number }) {
  const [draft, setDraft] = useState(label);
  const [result, action, pending] = useActionState(changeShipping, { error: '', message: '' });
  return (
    <form action={action}>
      <input type="hidden" name="version" value={version} />
      <label htmlFor="shipping-label">Public shipping label</label>
      <input
        id="shipping-label"
        name="label"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        disabled={pending}
      />
      <button disabled={pending}>{pending ? 'Saving…' : 'Save shipping'}</button>
      {result.error && <p role="alert">{result.error}</p>}
      <p role="status">{result.message}</p>
    </form>
  );
}
