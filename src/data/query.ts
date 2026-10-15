import type { Category, Place } from '../core/place';

export type SortKey = 'name' | 'newest' | 'country' | 'category' | 'nearest';

export interface Query {
  text: string;
  category: Category | '';
  tags: string[];
  sort: SortKey;
  /** Reference point for "nearest" sorting (e.g. the map centre). */
  near?: { lat: number; lng: number };
}

/** Case- and accent-insensitive search over name, country, description, why-strange and tags. */
export function filterPlaces(places: Place[], q: Query): Place[] {
  const needle = fold(q.text.trim());
  const out = places.filter((p) => {
    if (q.category && p.category !== q.category) return false;
    if (q.tags.length && !q.tags.every((t) => p.tags.includes(t))) return false;
    if (!needle) return true;
    const hay = fold([p.name, p.country, p.description, p.whyStrange, p.category, ...p.tags].join(' '));
    return needle.split(/\s+/).every((w) => hay.includes(w));
  });
  return sortPlaces(out, q.sort, q.near);
}

export function sortPlaces(places: Place[], key: SortKey, near?: { lat: number; lng: number }): Place[] {
  const arr = [...places];
  const byName = (a: Place, b: Place) => a.name.localeCompare(b.name);
  switch (key) {
    case 'newest':
      return arr.sort((a, b) => b.dateAdded.localeCompare(a.dateAdded) || byName(a, b));
    case 'country':
      return arr.sort((a, b) => a.country.localeCompare(b.country) || byName(a, b));
    case 'category':
      return arr.sort((a, b) => a.category.localeCompare(b.category) || byName(a, b));
    case 'nearest':
      if (near) return arr.sort((a, b) => distanceKm(near, a) - distanceKm(near, b));
      return arr.sort(byName);
    default:
      return arr.sort(byName);
  }
}

/** All tags with counts, most used first. */
export function tagCounts(places: Place[]): [string, number][] {
  const m = new Map<string, number>();
  for (const p of places) for (const t of p.tags) m.set(t, (m.get(t) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const r = Math.PI / 180;
  const s = Math.sin(((b.lat - a.lat) * r) / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(((b.lng - a.lng) * r) / 2) ** 2;
  return 12742 * Math.asin(Math.min(1, Math.sqrt(s)));
}

export function pickRandom<T>(items: T[], rand = Math.random, exclude?: T): T | undefined {
  const pool = items.length > 1 && exclude !== undefined ? items.filter((i) => i !== exclude) : items;
  return pool[Math.floor(rand() * pool.length)];
}

const fold = (s: string) => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
