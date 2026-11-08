import { Suspense } from 'react';
import { currentUser, publicShipping } from '../lib/data';
import { ShippingForm } from './ui/shipping-form';
async function Catalog() {
  const value = await publicShipping();
  return (
    <section>
      <h2>Public catalog</h2>
      <p data-testid="shipping">{value.label}</p>
    </section>
  );
}
async function Account() {
  const user = await currentUser();
  if (!user) return <p>Sign in through the local seed fixture to edit.</p>;
  return (
    <section>
      <h2>Account: {user.userId}</h2>
      {user.role === 'admin' ? <Editor /> : <p>Read-only account</p>}
    </section>
  );
}
async function Editor() {
  const value = await publicShipping();
  return <ShippingForm label={value.label} version={value.version} />;
}
export default function Page() {
  return (
    <>
      <h1>Shipping and orders</h1>
      <Catalog />
      <Suspense fallback={<p>Loading account…</p>}>
        <Account />
      </Suspense>
    </>
  );
}
