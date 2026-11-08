import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import Link from 'next/link';
import { Search } from '@/components/catalog/search';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Engineering Knowledge Base',
  description: 'Connected readings for backend engineering, architecture, and production systems.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-zinc-950 text-zinc-100">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:rounded-lg focus:bg-white focus:p-3 focus:text-black"
        >
          Skip to content
        </a>
        <header className="sticky top-0 z-40 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-8">
            <Link href="/" className="shrink-0 text-base font-semibold tracking-tight">
              <span className="mr-2 text-emerald-400">◈</span>Engineering KB
            </Link>
            <Search />
          </div>
        </header>
        <div id="main-content" tabIndex={-1}>
          {children}
        </div>
        <footer className="mx-auto mt-auto w-full max-w-6xl px-5 py-10 text-xs text-zinc-500 sm:px-8">
          Engineering Knowledge Base · Learn the foundations. Connect the tools.
        </footer>
      </body>
    </html>
  );
}
