import type { CategoryMotif } from '@/lib/catalog/category-appearance';
const paths: Record<CategoryMotif, string[]> = {
  layers: ['m4 8 8-4 8 4-8 4Z', 'm4 12 8 4 8-4', 'm4 16 8 4 8-4'],
  code: ['m8 6-6 6 6 6', 'm16 6 6 6-6 6', 'm14 4-4 16'],
  window: ['M3 5h18v15H3Z', 'M3 9h18', 'M7 5v4'],
  blocks: ['M3 3h7v7H3Z', 'M14 3h7v7h-7Z', 'M3 14h7v7H3Z', 'M14 14h7v7h-7Z'],
  check: ['M12 3 3 7v6c0 5 9 9 9 9s9-4 9-9V7Z', 'm8 12 3 3 5-6'],
  tools: ['m5 4 15 15', 'm4 5 3-2 3 3-4 4-3-3Z', 'm5 20 6-6', 'm14 11 6-6'],
  cloud: ['M6 18a4 4 0 0 1-1-8 7 7 0 0 1 13-2 5 5 0 0 1 0 10Z'],
  data: ['M3 6c0-4 18-4 18 0s-18 4-18 0Z', 'M3 6v12c0 4 18 4 18 0V6', 'M3 12c0 4 18 4 18 0'],
  events: ['M3 8h7v8H3Z', 'M16 3h5v5h-5Z', 'M16 16h5v5h-5Z', 'M10 12h3V5h3', 'M13 12v7h3'],
  shield: ['M12 3 3 7v6c0 5 9 9 9 9s9-4 9-9V7Z', 'M12 7v10'],
};
export function CategoryMark({
  motif,
  javascript = false,
}: {
  motif: CategoryMotif;
  javascript?: boolean;
}) {
  return (
    <span className="category-mark" aria-hidden="true">
      {javascript ? (
        <span className="category-js-mark">JS</span>
      ) : (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {paths[motif].map((d, index) => (
            <path key={index} d={d} />
          ))}
        </svg>
      )}
    </span>
  );
}
