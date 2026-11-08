import Image from 'next/image';
import Link from 'next/link';
import {
  categoryHref,
  categoryTopics,
  statusLabels,
  topicHref,
  type Category,
  type Topic,
} from '@/lib/catalog';
import { topicMinutes } from '@/lib/catalog/server';
export function CategoryCard({ category }: { category: Category }) {
  const readings = categoryTopics(category.id);
  const available = readings.filter((topic) => topic.contentPath).length;
  return (
    <Link
      href={categoryHref(category)}
      className="group flex h-full flex-col rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 transition hover:border-emerald-600 hover:bg-zinc-900"
    >
      <span className="text-xs font-semibold tracking-widest text-emerald-400 uppercase">
        Explore area <span aria-hidden="true">↗</span>
      </span>
      <h2 className="mt-4 text-xl font-semibold text-zinc-100">{category.title}</h2>
      <p className="mt-3 flex-1 text-sm leading-6 text-zinc-400">{category.description}</p>
      <p className="mt-6 text-xs text-zinc-500">
        {available} available · {readings.length - available} planned
      </p>
    </Link>
  );
}
export async function TopicCard({ topic }: { topic: Topic }) {
  const minutes = await topicMinutes(topic);
  return (
    <Link
      href={topicHref(topic)}
      className="flex h-full flex-col rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 transition hover:border-zinc-500 hover:bg-zinc-900"
    >
      <div className="flex items-center gap-3">
        {topic.icon ? (
          <Image
            src={`/icons/${topic.icon}`}
            alt=""
            width={32}
            height={32}
            className="h-8 w-8 object-contain"
          />
        ) : (
          <span
            aria-hidden="true"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-800 text-xs text-zinc-400"
          >
            {topic.title.slice(0, 2).toUpperCase()}
          </span>
        )}
        <h3 className="font-semibold text-zinc-100">{topic.title}</h3>
      </div>
      <p className="mt-3 flex-1 text-sm leading-6 text-zinc-400">{topic.description}</p>
      <div className="mt-5 flex flex-wrap items-center gap-3 text-xs">
        <span
          className={`rounded-full px-2.5 py-1 ${topic.status === 'complete' ? 'bg-emerald-950 text-emerald-300' : topic.status === 'review' ? 'bg-amber-950 text-amber-300' : 'bg-zinc-800 text-zinc-400'}`}
        >
          {statusLabels[topic.status]}
        </span>
        <span className="text-zinc-500">
          {minutes
            ? `~${minutes} min total${minutes > 40 ? ' · needs shortening' : ''}`
            : 'Reading not written yet'}
        </span>
      </div>
    </Link>
  );
}
