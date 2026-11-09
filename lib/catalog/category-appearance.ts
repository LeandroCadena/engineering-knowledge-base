// Color belongs to the root area; a motif can be reused under any ecosystem.
export const areaColors: Record<string, string> = {
  foundations: '#b9a0f5',
  javascript: '#f3d85e',
  web: '#66d7eb',
  databases: '#7cb4ff',
  messaging: '#fbaf75',
  cloud: '#a4baff',
  delivery: '#d9b18b',
  quality: '#83d9b4',
  security: '#f19db3',
};
export type CategoryMotif =
  | 'layers'
  | 'code'
  | 'window'
  | 'blocks'
  | 'check'
  | 'tools'
  | 'cloud'
  | 'data'
  | 'events'
  | 'shield';
export const categoryMotifs: Record<string, CategoryMotif> = {
  foundations: 'layers',
  javascript: 'code',
  web: 'window',
  databases: 'data',
  messaging: 'events',
  cloud: 'cloud',
  delivery: 'blocks',
  quality: 'check',
  security: 'shield',
  'js-languages': 'code',
  'js-backend': 'layers',
  'js-frontend': 'window',
  'js-libraries': 'blocks',
  'js-testing': 'check',
  'js-tooling': 'tools',
  aws: 'cloud',
};
export function areaColor(rootId: string) {
  return areaColors[rootId] ?? '#a4baff';
}
