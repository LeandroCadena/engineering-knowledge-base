import Link from 'next/link';
export function Breadcrumbs({ items }: { items: { title: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-8 text-sm text-zinc-400">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-2">
        <li>
          <Link href="/" className="hover:text-white">
            Home
          </Link>
        </li>
        {items.map((item, index) => (
          <li key={index} className="flex items-center gap-2">
            <span aria-hidden="true" className="text-zinc-600">
              /
            </span>
            {item.href ? (
              <Link href={item.href} className="hover:text-white">
                {item.title}
              </Link>
            ) : (
              <span aria-current="page" className="text-zinc-200">
                {item.title}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
