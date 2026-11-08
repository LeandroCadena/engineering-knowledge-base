'use client';
export default function ErrorBoundary({ reset }: { reset: () => void }) {
  return (
    <section>
      <h2>Request failed</h2>
      <button onClick={reset}>Try again</button>
    </section>
  );
}
