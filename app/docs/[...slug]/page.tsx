import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { MarkdownRenderer } from '@/components/markdown/markdown-renderer';
import { getDocumentBySlug, getMarkdownMetadata } from '@/lib/content';
import {
  categoryHref,
  categoryTrail,
  getTopic,
  relatedTopics,
  statusLabels,
  topicHref,
} from '@/lib/catalog';
import { topicByContentPath, topicMinutes } from '@/lib/catalog/server';
import { documentHeadings } from '@/lib/catalog/markdown';
import { Breadcrumbs } from '@/components/catalog/breadcrumbs';
import { TopicCard } from '@/components/catalog/cards';
import { ReadingProgress } from '@/components/catalog/reading-progress';
type Props = { params: Promise<{ slug: string[] }> };
export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const explicit = ['overview', 'deep-dive', 'reading'].includes(slug.at(-1) ?? '');
  const topic = topicByContentPath((explicit ? slug.slice(0, -1) : slug).join('/'));
  return { title: topic ? `${topic.title} · Engineering KB` : 'Engineering KB' };
}
export default async function DocumentPage({ params }: Props) {
  const { slug } = await params;
  if (
    !slug ||
    slug.length < 2 ||
    slug.some((segment) => segment.includes('..') || segment.includes('\\'))
  )
    notFound();
  const explicit = ['overview', 'deep-dive', 'reading'].includes(slug.at(-1) ?? '');
  const technologyPath = explicit ? slug.slice(0, -1) : slug;
  const topic = topicByContentPath(technologyPath.join('/'));
  if (!topic) notFound();
  if (topic.readingFile && explicit) redirect(topicHref(topic));
  const part = topic.readingFile ?? (explicit ? slug.at(-1)! : 'overview');
  const markdown = await getDocumentBySlug(
    topic.readingFile ? [...technologyPath, topic.readingFile] : slug,
  );
  if (!markdown) notFound();
  const { metadata, content } = getMarkdownMetadata(markdown);
  const headings = documentHeadings(content);
  const minutes = await topicMinutes(topic);
  const related = relatedTopics(topic);
  const prerequisites = topic.prerequisites.map(getTopic).filter((t) => t !== undefined);
  const href = topicHref(topic);
  return (
    <>
      <Breadcrumbs
        items={[
          ...categoryTrail(topic.category).map((category) => ({
            title: category.title,
            href: categoryHref(category),
          })),
          { title: topic.title },
        ]}
      />
      <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_240px]">
        <div className="min-w-0">
          <header className="mb-8 border-b border-zinc-800 pb-6">
            <p className="text-xs font-semibold tracking-widest text-emerald-400 uppercase">
              {topic.title}
            </p>
            <div className="mt-4 flex flex-wrap gap-3 text-xs text-zinc-400">
              <span>{statusLabels[topic.status]}</span>
              <span>
                ~{minutes} min · {topic.readingFile ? 'Complete reading' : 'Overview + Deep dive'}
              </span>
              {minutes && minutes > 40 ? (
                <span className="text-amber-400">
                  Above the 40-minute target · editorial revision planned
                </span>
              ) : null}
            </div>
            {!topic.readingFile && (
              <nav aria-label="Reading parts" className="mt-5 flex gap-2">
                {['overview', 'deep-dive'].map((value) => (
                  <Link
                    key={value}
                    href={`${href}/${value}`}
                    aria-current={part === value ? 'page' : undefined}
                    className={`rounded-lg px-4 py-2 text-sm ${part === value ? 'bg-zinc-100 font-semibold text-zinc-950' : 'bg-zinc-900 text-zinc-400 hover:text-white'}`}
                  >
                    {value === 'overview' ? 'Overview' : 'Deep dive'}
                  </Link>
                ))}
              </nav>
            )}
            <ReadingProgress
              key={slug.join('/')}
              topicId={topic.id}
              part={part}
              href={href}
              unified={!!topic.readingFile}
            />
            {!!prerequisites.length && (
              <p className="mt-4 text-sm leading-7 text-zinc-400">
                Recommended foundations:{' '}
                {prerequisites.map((item, i) => (
                  <span key={item.id}>
                    {i ? ' · ' : ''}
                    <Link href={topicHref(item)} className="text-emerald-400 hover:underline">
                      {item.title}
                      {item.status === 'planned' ? ' (planned)' : ''}
                    </Link>
                  </span>
                ))}
              </p>
            )}
          </header>
          <details className="mb-6 rounded-xl border border-zinc-800 p-4 lg:hidden">
            <summary className="cursor-pointer text-sm text-zinc-300">On this page</summary>
            <ul className="mt-3 space-y-2">
              {headings.map((heading) => (
                <li key={heading.id}>
                  <a href={`#${heading.id}`} className="text-sm text-zinc-400 hover:text-white">
                    {heading.title}
                  </a>
                </li>
              ))}
            </ul>
          </details>
          <article key={`${topic.id}-${part}`} id="reading-content" className="mx-auto max-w-3xl">
            {metadata.description && !topic.readingFile && (
              <p className="mb-8 text-lg leading-8 text-zinc-400">{metadata.description}</p>
            )}
            <MarkdownRenderer content={content} />
          </article>
          {metadata.updatedAt && (
            <p className="mt-10 text-xs text-zinc-500">
              Last updated:{' '}
              {metadata.updatedAt instanceof Date
                ? metadata.updatedAt.toISOString().slice(0, 10)
                : String(metadata.updatedAt)}
            </p>
          )}
          <nav
            aria-label="Document navigation"
            className="mt-10 flex flex-wrap justify-between gap-4 border-t border-zinc-800 pt-6"
          >
            <Link
              href={categoryHref(categoryTrail(topic.category).at(-1)!)}
              className="text-sm text-zinc-300 hover:text-white"
            >
              ← Back to {categoryTrail(topic.category).at(-1)!.title}
            </Link>
            {!topic.readingFile && (
              <Link
                href={`${href}/${part === 'overview' ? 'deep-dive' : 'overview'}`}
                className="text-sm font-medium text-emerald-400"
              >
                {part === 'overview' ? 'Continue to Deep dive →' : 'Back to Overview →'}
              </Link>
            )}
          </nav>
        </div>
        <aside className="sticky top-32 hidden max-h-[75vh] overflow-y-auto border-l border-zinc-800 pl-5 lg:block">
          <p className="mb-4 text-xs font-semibold tracking-widest text-zinc-500 uppercase">
            On this page
          </p>
          <nav aria-label="Table of contents">
            <ul className="space-y-3">
              {headings.map((heading) => (
                <li key={heading.id} style={{ paddingLeft: Math.max(0, heading.depth - 1) * 8 }}>
                  <a
                    href={`#${heading.id}`}
                    className="text-xs leading-5 text-zinc-400 hover:text-emerald-300"
                  >
                    {heading.title}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </aside>
      </div>
      {!!related.length && (
        <section className="mt-16 border-t border-zinc-800 pt-8">
          <h2 className="mb-5 text-xl font-semibold">Related readings</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((item) => (
              <TopicCard key={item.id} topic={item} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
