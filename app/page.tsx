import { categories, topics } from '@/lib/catalog';
import { CategoryCard } from '@/components/catalog/cards';
import { ContinueReading } from '@/components/catalog/reading-progress';
export default function HomePage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
      <p className="text-xs font-semibold tracking-[0.2em] text-emerald-400 uppercase">
        Your engineering field guide
      </p>
      <h1 className="mt-5 max-w-3xl text-4xl font-semibold tracking-tight text-zinc-100 sm:text-6xl">
        Understand the systems.
        <br />
        <span className="text-zinc-500">Connect the knowledge.</span>
      </h1>
      <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-400">
        Explore an area, choose a reading, and build a working understanding of the tools and
        principles behind modern backend engineering.
      </p>
      <p className="mt-5 text-sm text-zinc-500">
        {categories.filter((c) => !c.parent).length} areas ·{' '}
        {topics.filter((t) => t.contentPath).length} available readings ·{' '}
        {topics.filter((t) => !t.contentPath).length} planned
      </p>
      <ContinueReading
        topics={topics
          .filter((t) => t.contentPath)
          .map((t) => ({
            id: t.id,
            title: t.title,
            href: `/docs/${t.contentPath}`,
            unified: !!t.readingFile,
          }))}
      />
      <section aria-label="Knowledge areas" className="mt-10 grid grid-cols-1 gap-4">
        {categories
          .filter((category) => !category.parent)
          .map((category) => (
            <CategoryCard key={category.id} category={category} />
          ))}
      </section>
    </main>
  );
}
