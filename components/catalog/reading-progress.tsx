'use client';
import Link from 'next/link';
import { useEffect, useSyncExternalStore } from 'react';
const KEY = 'engineering-kb:reading-progress:v1';
type Progress = { part: string; section: string; percent: number; updatedAt: number };
type Records = Record<string, Progress>;
function snapshot() {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}
function subscribe(callback: () => void) {
  window.addEventListener('storage', callback);
  window.addEventListener('kb-progress', callback);
  return () => {
    window.removeEventListener('storage', callback);
    window.removeEventListener('kb-progress', callback);
  };
}
function parse(value: string | null): Records {
  try {
    const data: unknown = JSON.parse(value ?? '{}');
    if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
    return Object.fromEntries(
      Object.entries(data).filter(
        ([, p]) =>
          p &&
          typeof p === 'object' &&
          (p.part === 'overview' || p.part === 'deep-dive') &&
          typeof p.section === 'string' &&
          Number.isFinite(p.percent) &&
          p.percent >= 0 &&
          p.percent <= 100 &&
          Number.isFinite(p.updatedAt),
      ),
    );
  } catch {
    return {};
  }
}
function useProgress() {
  return parse(useSyncExternalStore(subscribe, snapshot, () => null));
}
export function ReadingProgress({
  topicId,
  part,
  href,
}: {
  topicId: string;
  part: string;
  href: string;
}) {
  const saved = useProgress()[topicId];
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let interacted = false;
    let leaving = false;
    let position: Progress | null = null;
    const article = document.getElementById('reading-content');
    const entryPath = window.location.pathname;
    const capture = () => {
      if (
        !interacted ||
        leaving ||
        !article ||
        !article.isConnected ||
        window.location.pathname !== entryPath ||
        document.getElementById('reading-content') !== article
      )
        return;
      const top = article.getBoundingClientRect().top + window.scrollY;
      const available = Math.max(1, article.offsetHeight - window.innerHeight);
      const percent = Math.max(
        0,
        Math.min(100, Math.round(((window.scrollY - top) / available) * 100)),
      );
      const headings = Array.from(article.querySelectorAll<HTMLElement>('h1[id], h2[id], h3[id]'));
      const section =
        headings.filter((heading) => heading.getBoundingClientRect().top <= 160).at(-1)?.id ?? '';
      position = { part, section, percent, updatedAt: Date.now() };
    };
    const save = () => {
      if (!position) return;
      const records = parse(snapshot());
      records[topicId] = position;
      try {
        localStorage.setItem(KEY, JSON.stringify(records));
        window.dispatchEvent(new Event('kb-progress'));
      } catch {
        /* Reading remains usable when storage is disabled. */
      }
    };
    const scroll = () => {
      capture();
      if (!timer)
        timer = setTimeout(() => {
          timer = undefined;
          save();
        }, 500);
    };
    const interact = (event: Event) => {
      const anchor = event.target instanceof Element ? event.target.closest('a[href]') : null;
      if (anchor instanceof HTMLAnchorElement && new URL(anchor.href).pathname !== entryPath) {
        save();
        leaving = true;
        return;
      }
      interacted = true;
    };
    window.addEventListener('wheel', interact, { passive: true });
    window.addEventListener('touchstart', interact, { passive: true });
    window.addEventListener('keydown', interact);
    window.addEventListener('pointerdown', interact);
    window.addEventListener('scroll', scroll, { passive: true });
    window.addEventListener('pagehide', save);
    return () => {
      clearTimeout(timer);
      save();
      window.removeEventListener('wheel', interact);
      window.removeEventListener('touchstart', interact);
      window.removeEventListener('keydown', interact);
      window.removeEventListener('pointerdown', interact);
      window.removeEventListener('scroll', scroll);
      window.removeEventListener('pagehide', save);
    };
  }, [topicId, part]);
  return (
    <div className="my-5 flex flex-wrap items-center gap-3 text-xs text-zinc-400">
      <span>
        Reading position saved on this device
        {saved
          ? ` · ${saved.part === 'overview' ? 'Overview' : 'Deep dive'} ${saved.percent}%`
          : ''}
        .
      </span>
      {saved && (
        <Link
          href={`${href}/${saved.part}${saved.section ? `#${saved.section}` : ''}`}
          className="font-medium text-emerald-400 hover:text-emerald-200"
        >
          Resume saved section
        </Link>
      )}
    </div>
  );
}
export function ContinueReading({
  topics,
}: {
  topics: { id: string; title: string; href: string }[];
}) {
  const records = useProgress();
  const latest = Object.entries(records)
    .filter(([id]) => topics.some((t) => t.id === id))
    .sort((a, b) => b[1].updatedAt - a[1].updatedAt)[0];
  if (!latest) return null;
  const topic = topics.find((t) => t.id === latest[0])!;
  const progress = latest[1];
  return (
    <Link
      href={`${topic.href}/${progress.part}${progress.section ? `#${progress.section}` : ''}`}
      className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-900 bg-emerald-950/30 p-5"
    >
      <span>
        <span className="block text-xs text-emerald-400">Continue reading</span>
        <span className="mt-1 block font-semibold">{topic.title}</span>
      </span>
      <span className="text-sm text-zinc-400">
        {progress.part === 'overview' ? 'Overview' : 'Deep dive'} · {progress.percent}%{' '}
        <span aria-hidden="true">→</span>
      </span>
    </Link>
  );
}
