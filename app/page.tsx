import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-10">
      <h1 className="text-4xl font-bold">Engineering Knowledge Base</h1>

      <p className="max-w-xl text-center text-gray-600">
        Personal technical documentation built with Next.js and Markdown.
      </p>

      <div className="flex gap-4">
        <Link
          href="/test"
          className="rounded-lg border px-4 py-2 hover:bg-gray-100"
        >
          Markdown Test
        </Link>

        <Link
          href="/navigation-test"
          className="rounded-lg border px-4 py-2 hover:bg-gray-100"
        >
          Navigation Test
        </Link>
      </div>
    </main>
  );
}