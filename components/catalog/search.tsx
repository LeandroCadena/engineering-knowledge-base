'use client';
import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';
type Result = {
  id: string;
  title: string;
  part: string | null;
  href: string;
  status: string;
  excerpt: string;
};
export function Search() {
  const [query, setQuery] = useState('');
  const [state, setState] = useState<{ results: Result[]; loading: boolean; error: boolean }>({
    results: [],
    loading: false,
    error: false,
  });
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      if (query.trim().length < 2) {
        setState({ results: [], loading: false, error: false });
        return;
      }
      setState({ results: [], loading: true, error: false });
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error('Search unavailable');
        const results: Result[] = await response.json();
        if (!controller.signal.aborted) setState({ results, loading: false, error: false });
      } catch {
        if (!controller.signal.aborted) setState({ results: [], loading: false, error: true });
      }
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);
  useEffect(() => {
    const dismiss = (event: PointerEvent) => {
      if (!panel.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, []);
  return (
    <div
      ref={panel}
      className="relative w-full max-w-lg"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <label htmlFor={id} className="sr-only">
        Search all readings and concepts
      </label>
      <input
        id={id}
        type="search"
        value={query}
        placeholder="Search readings and concepts…"
        autoComplete="off"
        aria-controls={`${id}-results`}
        onFocus={() => setOpen(true)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setOpen(false);
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500"
      />
      {open && query.trim().length >= 2 && (
        <div
          id={`${id}-results`}
          className="absolute right-0 left-0 z-50 mt-2 max-h-[65vh] overflow-y-auto rounded-xl border border-zinc-700 bg-zinc-950 p-2 shadow-2xl"
        >
          <p role="status" className="px-3 py-2 text-xs text-zinc-400">
            {state.loading
              ? 'Searching…'
              : state.error
                ? 'Search is unavailable. Please try again.'
                : state.results.length
                  ? `${state.results.length} matching readings`
                  : 'No matches found.'}
          </p>
          {!state.loading &&
            state.results.map((result) => (
              <Link
                key={`${result.id}-${result.part}`}
                href={result.href}
                onClick={() => setOpen(false)}
                className="block rounded-lg p-3 hover:bg-zinc-900"
              >
                <span className="font-medium text-zinc-100">{result.title}</span>
                <span className="ml-2 text-xs text-zinc-400">
                  {result.part === 'reading'
                    ? 'Reading'
                    : result.part === 'deep-dive'
                      ? 'Deep dive'
                      : result.part === 'overview'
                        ? 'Overview'
                        : 'Planned'}
                </span>
                <p className="mt-1 text-xs leading-5 text-zinc-400">{result.excerpt}</p>
              </Link>
            ))}
        </div>
      )}
    </div>
  );
}
