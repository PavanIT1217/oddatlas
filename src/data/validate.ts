import { CATEGORIES, type Place } from '../core/place';

const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const GMAPS = /^https:\/\/www\.google\.com\/maps\/@-?\d{1,2}(?:\.\d+)?,-?\d{1,3}(?:\.\d+)?,\d{1,2}z$/;

/**
 * Lightweight runtime validation mirroring schema/place.schema.json (used for imports and the
 * add/edit form in the browser, where shipping Ajv would be overkill). Returns error strings.
 */
export function validatePlace(p: unknown): string[] {
  const e: string[] = [];
  if (!p || typeof p !== 'object') return ['not an object'];
  const o = p as Record<string, unknown>;
  const str = (k: string, min: number, max: number) => {
    const v = o[k];
    if (typeof v !== 'string' || v.trim().length < min || v.length > max) e.push(`${k} must be ${min}–${max} characters`);
  };
  if (typeof o.id !== 'string' || !ID.test(o.id)) e.push('id must be a kebab-case slug');
  str('name', 2, 100);
  str('country', 2, 60);
  str('description', 20, 600);
  str('whyStrange', 20, 600);
  if (typeof o.lat !== 'number' || !(o.lat >= -90 && o.lat <= 90)) e.push('lat must be between -90 and 90');
  if (typeof o.lng !== 'number' || !(o.lng >= -180 && o.lng <= 180)) e.push('lng must be between -180 and 180');
  if (!CATEGORIES.includes(o.category as never)) e.push(`category must be one of ${CATEGORIES.join(', ')}`);
  if (!Number.isInteger(o.zoom) || (o.zoom as number) < 2 || (o.zoom as number) > 21) e.push('zoom must be an integer 2–21');
  if (typeof o.googleMapsUrl !== 'string' || !GMAPS.test(o.googleMapsUrl)) e.push('googleMapsUrl must look like https://www.google.com/maps/@LAT,LNG,ZOOMz');
  if (!Array.isArray(o.tags) || o.tags.some((t) => typeof t !== 'string' || !ID.test(t)) || new Set(o.tags).size !== o.tags.length)
    e.push('tags must be unique kebab-case strings');
  if (typeof o.dateAdded !== 'string' || !DATE.test(o.dateAdded) || Number.isNaN(Date.parse(o.dateAdded))) e.push('dateAdded must be YYYY-MM-DD');
  const extra = Object.keys(o).filter(
    (k) => !['id', 'name', 'lat', 'lng', 'country', 'category', 'description', 'whyStrange', 'googleMapsUrl', 'zoom', 'tags', 'dateAdded'].includes(k),
  );
  if (extra.length) e.push(`unknown field(s): ${extra.join(', ')}`);
  return e;
}

export function isPlace(p: unknown): p is Place {
  return validatePlace(p).length === 0;
}

/** Checks that need the whole catalogue: unique ids and Maps links that match lat/lng/zoom. */
export function validateCatalogue(places: unknown[]): string[] {
  const errors: string[] = [];
  const ids = new Set<string>();
  places.forEach((p, i) => {
    const label = `#${i} (${(p as Place)?.id ?? '?'})`;
    for (const err of validatePlace(p)) errors.push(`${label}: ${err}`);
    const place = p as Place;
    if (ids.has(place?.id)) errors.push(`${label}: duplicate id`);
    ids.add(place?.id);
    const m = /@(-?[\d.]+),(-?[\d.]+),(\d+)z$/.exec(place?.googleMapsUrl ?? '');
    if (m && (Math.abs(Number(m[1]) - place.lat) > 1e-4 || Math.abs(Number(m[2]) - place.lng) > 1e-4 || Number(m[3]) !== place.zoom))
      errors.push(`${label}: googleMapsUrl does not match lat/lng/zoom`);
  });
  return errors;
}
