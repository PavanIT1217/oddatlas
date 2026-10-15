import { describe, expect, it } from 'vitest';
import seed from '../data/places.json';
import { type Place, googleMapsUrl, slugify } from '../src/core/place';
import { filterPlaces, pickRandom, sortPlaces, tagCounts } from '../src/data/query';
import { Catalogue, parseImport, type StorageLike } from '../src/data/store';
import { validateCatalogue, validatePlace } from '../src/data/validate';

const places = seed as Place[];

class MemoryStorage implements StorageLike {
  data = new Map<string, string>();
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
  removeItem(k: string) {
    this.data.delete(k);
  }
}

const sample = (over: Partial<Place> = {}): Place => ({
  id: 'test-place',
  name: 'Test Place',
  lat: 10,
  lng: 20,
  country: 'Nowhere',
  category: 'other',
  description: 'A perfectly ordinary test description.',
  whyStrange: 'It only exists inside the unit tests.',
  googleMapsUrl: googleMapsUrl(10, 20, 12),
  zoom: 12,
  tags: ['test'],
  dateAdded: '2026-10-15',
  ...over,
});

describe('seed data (data/places.json)', () => {
  it('has about 25 places and passes catalogue validation', () => {
    expect(places.length).toBeGreaterThanOrEqual(25);
    expect(validateCatalogue(places)).toEqual([]);
  });

  it('includes the expected well-known places', () => {
    const ids = places.map((p) => p.id);
    for (const id of ['richat-structure', 'great-blue-hole', 'darvaza-gas-crater', 'spiral-jetty']) expect(ids).toContain(id);
  });
});

describe('validation', () => {
  it('accepts a good place and reports specific problems', () => {
    expect(validatePlace(sample())).toEqual([]);
    expect(validatePlace(sample({ lat: 91 }))).toContain('lat must be between -90 and 90');
    expect(validatePlace(sample({ id: 'Bad Id' })).join()).toMatch(/kebab-case/);
    expect(validatePlace(sample({ category: 'nope' as never })).join()).toMatch(/category/);
    expect(validatePlace(sample({ googleMapsUrl: 'https://maps.example' })).join()).toMatch(/googleMapsUrl/);
    expect(validatePlace({ ...sample(), extra: 1 }).join()).toMatch(/unknown field/);
    expect(validatePlace(null)).toEqual(['not an object']);
  });

  it('catches duplicate ids and mismatched Maps links', () => {
    const errs = validateCatalogue([sample(), sample(), sample({ id: 'other', googleMapsUrl: googleMapsUrl(1, 2, 3) })]);
    expect(errs.some((e) => e.includes('duplicate id'))).toBe(true);
    expect(errs.some((e) => e.includes('does not match'))).toBe(true);
  });

  it('helpers', () => {
    expect(googleMapsUrl(12.3456789, -45.6789012, 14.4)).toBe('https://www.google.com/maps/@12.34568,-45.6789,14z');
    expect(slugify('Galešnjak (Island of Love)!')).toBe('galesnjak-island-of-love');
    expect(slugify('***')).toBe('place');
  });
});

describe('Catalogue store', () => {
  it('layers additions, edits and deletions over the seed and persists them', () => {
    const storage = new MemoryStorage();
    const c = new Catalogue(places, storage);
    c.add(sample());
    c.update({ ...places[0], name: 'Renamed' });
    c.remove(places[1].id);
    expect(c.all()).toHaveLength(places.length);
    expect(c.get(places[0].id)!.name).toBe('Renamed');
    expect(c.get(places[1].id)).toBeUndefined();
    expect(c.isModified(places[0].id)).toBe(true);

    const reloaded = new Catalogue(places, storage);
    expect(reloaded.all().map((p) => p.id)).toEqual(c.all().map((p) => p.id));
    reloaded.reset();
    expect(reloaded.all()).toEqual(places);
  });

  it('rejects invalid or duplicate places', () => {
    const c = new Catalogue(places, new MemoryStorage());
    expect(() => c.add(sample({ lat: 200 }))).toThrow(/Invalid/);
    expect(() => c.add({ ...places[0] })).toThrow(/already exists/);
    expect(c.uniqueId(places[0].id)).toBe(`${places[0].id}-2`);
  });

  it('removes user-added places completely', () => {
    const c = new Catalogue(places, new MemoryStorage());
    c.add(sample());
    c.remove('test-place');
    expect(c.get('test-place')).toBeUndefined();
    expect(c.all()).toHaveLength(places.length);
  });

  it('imports in merge and replace modes', () => {
    const c = new Catalogue(places, new MemoryStorage());
    const r1 = c.import([sample(), { ...places[0], name: 'Edited by import' }], 'merge');
    expect(r1).toMatchObject({ added: 1, updated: 1 });
    expect(c.all()).toHaveLength(places.length + 1);

    const r2 = c.import([places[2], sample({ id: 'only-new' })], 'replace');
    expect(c.all().map((p) => p.id).sort()).toEqual([places[2].id, 'only-new'].sort());
    expect(r2.removed).toBe(places.length);
  });

  it('does not mark unchanged places as edits when re-importing an export', () => {
    const c = new Catalogue(places, new MemoryStorage());
    c.add(sample());
    const r = c.import(parseImport(c.exportJson()).places, 'merge');
    expect(r).toEqual({ added: 0, updated: 0, removed: 0, unchanged: places.length + 1 });
    expect(places.some((p) => c.isModified(p.id))).toBe(false);
    c.update({ ...places[0], name: 'Something else' });
    c.update(places[0]); // back to the original
    expect(c.isModified(places[0].id)).toBe(false);
  });

  it('round-trips through export and import', () => {
    const c = new Catalogue(places, new MemoryStorage());
    c.add(sample());
    const { places: parsed, errors } = parseImport(c.exportJson());
    expect(errors).toEqual([]);
    expect(parsed).toHaveLength(places.length + 1);
    expect(parseImport('{"places": []}').places).toEqual([]);
    expect(parseImport('nope').errors[0]).toMatch(/not valid JSON/);
    expect(parseImport('[{"id":"x"}]').errors).toHaveLength(1);
  });

  it('survives corrupt storage and missing storage', () => {
    const storage = new MemoryStorage();
    storage.setItem('oddatlas:catalogue:v1', '{broken');
    expect(new Catalogue(places, storage).all()).toHaveLength(places.length);
    const noStorage = new Catalogue(places, null);
    noStorage.add(sample());
    expect(noStorage.all()).toHaveLength(places.length + 1);
  });
});

describe('search, filters and sorting', () => {
  it('searches across fields, accent-insensitively', () => {
    expect(filterPlaces(places, { text: 'galesnjak', category: '', tags: [], sort: 'name' })[0].id).toBe('galesnjak');
    expect(filterPlaces(places, { text: 'nuclear', category: '', tags: [], sort: 'name' }).map((p) => p.id)).toContain('sedan-crater');
    expect(filterPlaces(places, { text: 'pink salt', category: '', tags: [], sort: 'name' }).every((p) => p.category === 'water')).toBe(true);
  });

  it('filters by category and tags', () => {
    const forts = filterPlaces(places, { text: '', category: 'fortification', tags: [], sort: 'name' });
    expect(forts.map((p) => p.id).sort()).toEqual(['bourtange', 'palmanova']);
    const pink = filterPlaces(places, { text: '', category: '', tags: ['pink-lake'], sort: 'name' });
    expect(pink.map((p) => p.id).sort()).toEqual(['lake-hillier', 'lake-retba']);
  });

  it('sorts by name, country, newest and distance', () => {
    const byName = sortPlaces(places, 'name').map((p) => p.name);
    expect(byName).toEqual([...byName].sort((a, b) => a.localeCompare(b)));
    const near = sortPlaces(places, 'nearest', { lat: 41.4, lng: -112.6 });
    expect(near[0].id).toBe('spiral-jetty');
    const newest = sortPlaces([sample({ dateAdded: '2020-01-01' }), sample({ id: 'b', dateAdded: '2027-01-01' })], 'newest');
    expect(newest[0].id).toBe('b');
  });

  it('counts tags and picks random places', () => {
    const counts = tagCounts(places);
    expect(counts[0][1]).toBeGreaterThanOrEqual(counts[counts.length - 1][1]);
    expect(pickRandom(places, () => 0)).toBe(places[0]);
    expect(pickRandom(places, () => 0, places[0])).toBe(places[1]);
    expect(pickRandom([], Math.random)).toBeUndefined();
  });
});
