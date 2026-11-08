import { notFound } from 'next/navigation';
import {
  categories,
  categoryHref,
  categoryTopics,
  categoryTrail,
  getCategory,
  topics,
} from '@/lib/catalog';
import { Breadcrumbs } from '@/components/catalog/breadcrumbs';
import { CategoryCard, TopicCard } from '@/components/catalog/cards';
export async function generateMetadata({ params }: { params: Promise<{ category: string }> }) {
  const category = getCategory((await params).category);
  return { title: category ? `${category.title} · Engineering KB` : 'Area not found' };
}
export default async function CategoryPage({ params }: { params: Promise<{ category: string }> }) {
  const category = getCategory((await params).category);
  if (!category) notFound();
  const children = categories.filter((item) => item.parent === category.id);
  const direct = topics
    .filter((topic) => topic.category === category.id)
    .sort((a, b) => a.order - b.order);
  const ownIds = new Set(categoryTopics(category.id).map((topic) => topic.id));
  const related = topics.filter(
    (topic) => !ownIds.has(topic.id) && category.tags.some((tag) => topic.tags.includes(tag)),
  );
  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8">
      <Breadcrumbs
        items={categoryTrail(category.id).map((item) => ({
          title: item.title,
          href: item.id === category.id ? undefined : categoryHref(item),
        }))}
      />
      <p className="text-xs font-semibold tracking-widest text-emerald-400 uppercase">
        Knowledge area
      </p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">{category.title}</h1>
      <p className="mt-5 max-w-2xl text-lg leading-8 text-zinc-400">{category.description}</p>
      {!!children.length && (
        <section
          aria-label="Subcategories"
          className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {children.map((child) => (
            <CategoryCard key={child.id} category={child} />
          ))}
        </section>
      )}
      {!!direct.length && (
        <section className="mt-10">
          <h2 className="mb-5 text-xl font-semibold">
            Readings <span className="ml-2 text-sm font-normal text-zinc-500">{direct.length}</span>
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {direct.map((topic) => (
              <TopicCard key={topic.id} topic={topic} />
            ))}
          </div>
        </section>
      )}
      {!!related.length && (
        <section className="mt-14 border-t border-zinc-800 pt-8">
          <h2 className="text-xl font-semibold">Related across the knowledge base</h2>
          <p className="mt-2 mb-5 text-sm text-zinc-400">
            Connected readings from other areas. Each opens its original document.
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((topic) => (
              <TopicCard key={topic.id} topic={topic} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
