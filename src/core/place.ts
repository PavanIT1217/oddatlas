export const CATEGORIES = [
  'geoglyph',
  'landform',
  'water',
  'abandoned',
  'structure',
  'installation',
  'crater',
  'artificial-island',
  'fortification',
  'art',
  'other',
] as const;

export type Category = (typeof CATEGORIES)[number];

export interface Place {
  id: string;
  name: string;
  lat: number;
  lng: number;
  country: string;
  category: Category;
  description: string;
  whyStrange: string;
  googleMapsUrl: string;
  zoom: number;
  tags: string[];
  /** ISO date, YYYY-MM-DD */
  dateAdded: string;
}

export const CATEGORY_LABEL: Record<Category, string> = {
  geoglyph: 'Geoglyph',
  landform: 'Bizarre landform',
  water: 'Strange water',
  abandoned: 'Abandoned',
  structure: 'Odd structure',
  installation: 'Mysterious installation',
  crater: 'Crater & pit',
  'artificial-island': 'Artificial island',
  fortification: 'Fortification',
  art: 'Land art',
  other: 'Other',
};

/** Short telemetry-style codes used in the HUD (markers, list badges, card). */
export const CATEGORY_CODE: Record<Category, string> = {
  geoglyph: 'GEO',
  landform: 'LND',
  water: 'H2O',
  abandoned: 'ABN',
  structure: 'STR',
  installation: 'INS',
  crater: 'CRT',
  'artificial-island': 'ISL',
  fortification: 'FRT',
  art: 'ART',
  other: 'UNK',
};

/** Canonical Google Maps link for a view, as stored in places.json. */
export function googleMapsUrl(lat: number, lng: number, zoom: number): string {
  return `https://www.google.com/maps/@${roundCoord(lat)},${roundCoord(lng)},${Math.round(zoom)}z`;
}

export const roundCoord = (v: number) => Math.round(v * 1e5) / 1e5;

export function slugify(s: string): string {
  return (
    s
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64) || 'place'
  );
}
