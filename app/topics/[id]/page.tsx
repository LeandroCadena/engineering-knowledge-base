import { notFound, redirect } from 'next/navigation';
import {
  categoryHref,
  categoryTrail,
  concepts,
  getTopic,
  relatedTopics,
  topicHref,
} from '@/lib/catalog';
import { Breadcrumbs } from '@/components/catalog/breadcrumbs';
import { TopicCard } from '@/components/catalog/cards';
export default async function PlannedTopicPage({ params }: { params: Promise<{ id: string }> }) {
  const topic = getTopic((await params).id);
  if (!topic) notFound();
  if (topic.contentPath) redirect(topicHref(topic));
  const related = relatedTopics(topic);
  const owned = concepts.filter((concept) => concept.owner === topic.id);
  return (
    <main className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8">
      <Breadcrumbs
        items={[
          ...categoryTrail(topic.category).map((c) => ({ title: c.title, href: categoryHref(c) })),
          { title: topic.title },
        ]}
      />
      <span className="rounded-full bg-zinc-800 px-3 py-1 text-xs text-zinc-300">
        Planned reading
      </span>
      <h1 className="mt-5 text-4xl font-semibold">{topic.title}</h1>
      <p className="mt-5 max-w-2xl text-lg leading-8 text-zinc-400">{topic.description}</p>
      <p className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900 p-5 text-sm leading-6 text-zinc-400">
        This reading is part of the roadmap. Its content has not been written yet. New readings will
        aim for a complete review in 40 minutes or less.
      </p>
      {!!owned.length && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold">Concepts this reading will explain</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-zinc-400">
            {owned.map((c) => (
              <li key={c.id}>{c.title}</li>
            ))}
          </ul>
        </section>
      )}
      {!!related.length && (
        <section className="mt-10">
          <h2 className="mb-5 text-xl font-semibold">Related readings</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {related.map((item) => (
              <TopicCard key={item.id} topic={item} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
