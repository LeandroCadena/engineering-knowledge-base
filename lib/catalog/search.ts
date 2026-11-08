import type { SearchEntry } from './server';
export function normalize(text: string) {
  return text.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
}
export function searchCatalog(entries: SearchEntry[], query: string) {
  const terms = normalize(query.trim()).split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  return entries
    .flatMap((entry) => {
      const normalized = normalize(entry.text);
      if (!terms.every((term) => normalized.includes(term))) return [];
      const title = normalize(entry.title);
      const score = terms.reduce((total, term) => total + (title.includes(term) ? 10 : 1), 0);
      const at = Math.max(0, normalized.indexOf(terms[0]) - 55);
      return [
        {
          ...entry,
          text: undefined,
          excerpt: `${at ? '…' : ''}${entry.text.slice(at, at + 190)}${at + 190 < entry.text.length ? '…' : ''}`,
          score,
        },
      ];
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);
}
