'use client';
import Link from 'next/link';
import { Fragment, useEffect, useRef, useState } from 'react';
import { fittingPreviewCount, type PreviewItem } from '@/lib/catalog/icon-preview';

export function CategoryPreview({
  items,
  categoryHref,
}: {
  items: PreviewItem[];
  categoryHref: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [count, setCount] = useState(0);
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      setCount(fittingPreviewCount(items, entry.contentRect.width));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [items]);
  const hidden = items.length - count;
  return (
    <div
      ref={container}
      className="category-preview"
      aria-label="Readings in this section"
      data-preview-count={count}
    >
      {items.slice(0, count).map((item, index) => (
        <Fragment key={item.id}>
          {index > 0 && item.group !== items[index - 1].group && (
            <span className="category-preview-divider" aria-hidden="true" />
          )}
          <Link
            href={item.href}
            className="category-preview-item"
            aria-label={`${item.title}${item.available ? '' : ' (planned)'}`}
          >
            <span className="category-preview-tooltip" aria-hidden="true">
              {item.groupTitle} · {item.title}
              {item.available ? '' : ' · Planned'}
            </span>
            {item.icon ? (
              // Small local brand assets do not need the image optimization pipeline.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/icons/${item.icon}`} alt="" width={24} height={24} />
            ) : (
              <span className="category-preview-initials" aria-hidden="true">
                {item.title.slice(0, 2).toUpperCase()}
              </span>
            )}
          </Link>
        </Fragment>
      ))}
      {hidden > 0 && (
        <Link
          href={categoryHref}
          className="category-preview-overflow"
          aria-label={`Explore section: ${hidden} more readings`}
        >
          +{hidden}
          <span className="category-preview-tooltip" aria-hidden="true">
            Explore section · {hidden} more readings
          </span>
        </Link>
      )}
    </div>
  );
}
