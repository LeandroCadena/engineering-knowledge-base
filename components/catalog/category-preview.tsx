'use client';
import { Fragment, useEffect, useRef, useState } from 'react';
import { fittingPreviewCount, type PreviewItem } from '@/lib/catalog/icon-preview';

export function CategoryPreview({ items }: { items: PreviewItem[] }) {
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
          <span
            className="category-preview-item"
            title={`${item.groupTitle} · ${item.title}${item.available ? '' : ' · Planned'}`}
          >
            {item.icon ? (
              // Small local brand assets do not need the image optimization pipeline.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/icons/${item.icon}`} alt={item.title} width={24} height={24} />
            ) : (
              <span
                className="category-preview-initials"
                role="img"
                aria-label={item.available ? item.title : `${item.title} (planned)`}
              >
                {item.title.slice(0, 2).toUpperCase()}
              </span>
            )}
          </span>
        </Fragment>
      ))}
      {hidden > 0 && (
        <span
          className="category-preview-overflow"
          title={items
            .slice(count)
            .map((item) => item.title)
            .join(', ')}
          aria-label={`${hidden} more readings`}
        >
          +{hidden}
        </span>
      )}
    </div>
  );
}
