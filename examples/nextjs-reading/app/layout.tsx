import type { Metadata } from 'next';
import Link from 'next/link';
import { Counter } from './ui/counter';
import './style.css';
export const metadata: Metadata = {
  title: 'Next.js reading example',
  description: 'Public cache and request-scoped order access.',
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header>
          <Link href="/">Home</Link> · <Link href="/orders/order-104">Order 104</Link> ·{' '}
          <Link href="/orders/order-105">Order 105</Link>
          <Counter />
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
