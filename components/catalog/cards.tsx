import type { CSSProperties } from 'react';
import { areaColor, categoryMotifs } from '@/lib/catalog/category-appearance';
import { CategoryMark } from './category-mark';
import { CategoryPreview } from './category-preview';
import Image from 'next/image';
import Link from 'next/link';
import {
  categoryHref,
  categoryTopics,
  categoryTrail,
  categories,
  getCategory,
  statusLabels,
  topicHref,
  type Category,
  type Topic,
} from '@/lib/catalog';
import { topicMinutes } from '@/lib/catalog/server';
export function CategoryCard({ category }: { category: Category }) {
  const readings = categoryTopics(category.id);
  const available = readings.filter((topic) => topic.contentPath).length;
  const sections = categories.filter((item) => item.parent === category.id).length;
  const root = categoryTrail(category.id)[0] ?? category;
  const motif = categoryMotifs[category.id] ?? 'layers';
  // Group by the owning category; preserve the catalog order inside each group.
  const groups = [...new Set(readings.map((topic) => topic.category))];
  const items = groups.flatMap((group) =>
    readings
      .filter((topic) => topic.category === group)
      .map((topic) => ({
        id: topic.id,
        title: topic.title,
        icon: topic.icon,
        group,
        groupTitle: getCategory(group)?.title ?? category.title,
        available: !!topic.contentPath,
        href: topicHref(topic),
      })),
  );
  return (
    <article
      className="category-card"
      data-category={category.id}
      data-area={root.id}
      data-motif={motif}
      style={{ '--area-accent': areaColor(root.id) } as CSSProperties}
      aria-labelledby={`category-${category.id}-title`}
      aria-describedby={`category-${category.id}-description category-${category.id}-counts`}
    >
      <CategoryMark motif={motif} javascript={category.id === 'javascript'} />
      <div className="category-card-content">
        <div className="category-card-heading">
          <span className="category-card-label">
            {category.parent ? 'Explore section' : 'Explore area'}
          </span>
          <div className="category-card-meta">
            <p id={`category-${category.id}-counts`} className="category-card-counts">
              {sections > 0 && <span>{sections} sections · </span>}
              {available} available · {readings.length - available} planned
            </p>
            <span className="category-card-arrow" aria-hidden="true">
              ↗
            </span>
          </div>
        </div>
        <h2 id={`category-${category.id}-title`}>
          <Link
            className="category-card-link"
            href={categoryHref(category)}
            aria-describedby={`category-${category.id}-description category-${category.id}-counts`}
          >
            {category.title}
          </Link>
        </h2>
        <p id={`category-${category.id}-description`} className="category-card-description">
          {category.description}
        </p>
        <div className="category-card-footer">
          <CategoryPreview items={items} categoryHref={categoryHref(category)} />
        </div>
      </div>
      <span className="category-card-motif" aria-hidden="true" />
    </article>
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
