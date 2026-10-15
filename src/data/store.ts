import type { Place } from '../core/place';
import { validatePlace } from './validate';

const KEY = 'oddatlas:catalogue:v1';

/** User changes layered on top of the seed catalogue (persisted in localStorage). */
export interface Overlay {
  added: Place[];
  edited: Record<string, Place>;
  deleted: string[];
}

export interface StorageLike {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

const emptyOverlay = (): Overlay => ({ added: [], edited: {}, deleted: [] });

/**
 * The catalogue = seed (data/places.json) + the user's overlay. Keeping only the overlay means
 * new seed entries shipped in an update still appear for existing users.
 */
export class Catalogue {
  private overlay: Overlay;
  private listeners = new Set<() => void>();

  constructor(
    private readonly seed: Place[],
    private readonly storage: StorageLike | null = safeLocalStorage(),
  ) {
    this.overlay = this.load();
  }

  private load(): Overlay {
    try {
      const raw = this.storage?.getItem(KEY);
      if (!raw) return emptyOverlay();
      const o = JSON.parse(raw) as Partial<Overlay>;
      return {
        added: (o.added ?? []).filter((p) => validatePlace(p).length === 0),
        edited: Object.fromEntries(Object.entries(o.edited ?? {}).filter(([, p]) => validatePlace(p).length === 0)),
        deleted: (o.deleted ?? []).filter((d) => typeof d === 'string'),
      };
    } catch {
      return emptyOverlay();
    }
  }

  private save(): void {
    try {
      this.storage?.setItem(KEY, JSON.stringify(this.overlay));
    } catch {
      /* quota / private mode: changes stay in memory for this session */
    }
    this.listeners.forEach((l) => l());
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  all(): Place[] {
    const deleted = new Set(this.overlay.deleted);
    const fromSeed = this.seed.filter((p) => !deleted.has(p.id)).map((p) => this.overlay.edited[p.id] ?? p);
    return [...fromSeed, ...this.overlay.added.filter((p) => !deleted.has(p.id))];
  }

  get(id: string): Place | undefined {
    return this.all().find((p) => p.id === id);
  }

  isSeed(id: string): boolean {
    return this.seed.some((p) => p.id === id);
  }

  isModified(id: string): boolean {
    return id in this.overlay.edited || this.overlay.added.some((p) => p.id === id);
  }

  /** A unique id derived from `base`. */
  uniqueId(base: string): string {
    const taken = new Set([...this.seed.map((p) => p.id), ...this.overlay.added.map((p) => p.id)]);
    let id = base;
    for (let i = 2; taken.has(id); i++) id = `${base}-${i}`;
    return id;
  }

  add(p: Place): void {
    assertValid(p);
    if (this.seed.some((s) => s.id === p.id) || this.overlay.added.some((s) => s.id === p.id)) throw new Error(`id "${p.id}" already exists`);
    this.overlay.added.push(p);
    this.overlay.deleted = this.overlay.deleted.filter((d) => d !== p.id);
    this.save();
  }

  update(p: Place): void {
    assertValid(p);
    this.applyUpdate(p);
    this.save();
  }

  private applyUpdate(p: Place): void {
    const i = this.overlay.added.findIndex((a) => a.id === p.id);
    if (i >= 0) this.overlay.added[i] = p;
    else if (this.isSeed(p.id)) {
      // Editing a seed place back to its original content is not an edit.
      if (same(p, this.seed.find((s) => s.id === p.id)!)) delete this.overlay.edited[p.id];
      else this.overlay.edited[p.id] = p;
    } else throw new Error(`unknown id "${p.id}"`);
  }

  remove(id: string): void {
    const i = this.overlay.added.findIndex((a) => a.id === id);
    if (i >= 0) this.overlay.added.splice(i, 1);
    else if (this.isSeed(id) && !this.overlay.deleted.includes(id)) this.overlay.deleted.push(id);
    delete this.overlay.edited[id];
    this.save();
  }

  /** Forget all local changes. */
  reset(): void {
    this.overlay = emptyOverlay();
    this.save();
  }

  /**
   * Import a full catalogue. `replace` makes the catalogue exactly the file's contents;
   * `merge` adds new ids and overwrites matching ones, keeping everything else.
   */
  import(places: Place[], mode: 'merge' | 'replace'): { added: number; updated: number; removed: number; unchanged: number } {
    places.forEach(assertValid);
    let added = 0;
    let updated = 0;
    let removed = 0;
    let unchanged = 0;
    const incoming = new Map(places.map((p) => [p.id, p]));
    if (mode === 'replace') {
      const next = emptyOverlay();
      for (const s of this.seed) {
        const p = incoming.get(s.id);
        if (!p) next.deleted.push(s.id);
        else if (!same(p, s)) next.edited[s.id] = p;
      }
      for (const p of places) if (!this.isSeed(p.id)) next.added.push(p);
      const before = new Map(this.all().map((p) => [p.id, p]));
      this.overlay = next;
      for (const p of this.all()) {
        const old = before.get(p.id);
        if (!old) added++;
        else if (same(old, p)) unchanged++;
        else updated++;
      }
      removed = [...before.keys()].filter((id) => !incoming.has(id)).length;
    } else {
      for (const p of places) {
        const existing = this.get(p.id);
        if (existing) {
          if (same(existing, p)) {
            unchanged++;
            continue;
          }
          this.applyUpdate(p);
          updated++;
        } else {
          if (this.isSeed(p.id)) {
            this.overlay.deleted = this.overlay.deleted.filter((d) => d !== p.id);
            this.overlay.edited[p.id] = p;
          } else this.overlay.added.push(p);
          added++;
        }
      }
    }
    this.save();
    return { added, updated, removed, unchanged };
  }

  /** The full catalogue as pretty JSON (same shape as data/places.json). */
  exportJson(): string {
    return `${JSON.stringify(this.all(), null, 2)}\n`;
  }
}

const same = (a: Place, b: Place) => JSON.stringify(a) === JSON.stringify(b);

function assertValid(p: Place): void {
  const errors = validatePlace(p);
  if (errors.length) throw new Error(`Invalid place "${(p as Place)?.name ?? '?'}": ${errors.join('; ')}`);
}

function safeLocalStorage(): StorageLike | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** Parse an imported JSON file: accepts an array of places or { places: [...] }. */
export function parseImport(text: string): { places: Place[]; errors: string[] } {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { places: [], errors: ['File is not valid JSON.'] };
  }
  const arr = Array.isArray(data) ? data : Array.isArray((data as { places?: unknown })?.places) ? (data as { places: unknown[] }).places : null;
  if (!arr) return { places: [], errors: ['Expected an array of places.'] };
  const errors: string[] = [];
  const places: Place[] = [];
  const ids = new Set<string>();
  arr.forEach((p, i) => {
    const e = validatePlace(p);
    if (e.length) errors.push(`Item ${i + 1}: ${e.join('; ')}`);
    else if (ids.has((p as Place).id)) errors.push(`Item ${i + 1}: duplicate id ${(p as Place).id}`);
    else {
      ids.add((p as Place).id);
      places.push(p as Place);
    }
  });
  return { places, errors };
}
