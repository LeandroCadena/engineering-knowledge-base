import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { privateOrder } from '../../../lib/data';
async function Order({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await privateOrder(id);
  if (!order) notFound();
  return (
    <article>
      <h2>{order.id}</h2>
      <p>{order.status}</p>
    </article>
  );
}
export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <>
      <h1>Private order</h1>
      <Suspense fallback={<p>Loading order…</p>}>
        <Order params={params} />
      </Suspense>
    </>
  );
}
