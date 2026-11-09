export type PreviewItem = {
  id: string;
  href: string;
  title: string;
  icon: string | null;
  group: string;
  groupTitle: string;
  available: boolean;
};
export const ICON_CELL = 36;
export const GROUP_DIVIDER = 17;
export const OVERFLOW_CELL = 48;

// Keep a stable prefix. A divider is counted only if both neighboring groups are visible.
export function previewWidth(items: Pick<PreviewItem, 'group'>[], count: number) {
  let width = count * ICON_CELL;
  for (let i = 1; i < count; i++) {
    if (items[i].group !== items[i - 1].group) width += GROUP_DIVIDER;
  }
  return width;
}
export function fittingPreviewCount(items: Pick<PreviewItem, 'group'>[], width: number) {
  for (let count = items.length; count >= 0; count--) {
    const required = previewWidth(items, count) + (count < items.length ? OVERFLOW_CELL : 0);
    if (required <= width) return count;
  }
  return 0;
}
