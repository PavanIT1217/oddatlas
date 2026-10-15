import { CATEGORIES, CATEGORY_LABEL, type Category, type Place, googleMapsUrl, roundCoord, slugify } from '../core/place';
import { parseGoogleMapsUrl } from '../data/googleMaps';
import { validatePlace } from '../data/validate';
import { byId, h } from './dom';

export interface FormHooks {
  mapCenter(): { lat: number; lng: number; zoom: number };
  uniqueId(base: string): string;
  save(p: Place, isNew: boolean): void;
}

/** Add / edit dialog with Google Maps link parsing. */
export class PlaceForm {
  private readonly dialog = byId<HTMLDialogElement>('form-dialog');
  private readonly form = byId<HTMLFormElement>('place-form');
  private readonly status = byId('gmaps-status');
  private readonly errors = byId('form-errors');
  private editing: Place | null = null;

  constructor(private readonly hooks: FormHooks) {
    const cat = this.field<HTMLSelectElement>('category');
    for (const c of CATEGORIES) cat.append(h('option', { value: c }, CATEGORY_LABEL[c]));

    const gmaps = this.field<HTMLInputElement>('gmaps');
    const onLink = () => this.applyLink(gmaps.value);
    gmaps.addEventListener('input', onLink);
    gmaps.addEventListener('paste', () => setTimeout(onLink, 0));

    byId<HTMLButtonElement>('use-map-center').addEventListener('click', () => {
      const c = this.hooks.mapCenter();
      this.set('lat', String(roundCoord(c.lat)));
      this.set('lng', String(roundCoord(c.lng)));
      this.set('zoom', String(Math.max(2, Math.min(21, Math.round(c.zoom)))));
    });

    this.form.addEventListener('submit', (e) => {
      const submitter = (e as SubmitEvent).submitter as HTMLButtonElement | null;
      if (submitter?.value !== 'save') return;
      e.preventDefault();
      this.submit();
    });
  }

  open(p?: Place): void {
    this.editing = p ?? null;
    this.form.reset();
    this.errors.hidden = true;
    this.status.textContent = '';
    this.status.className = 'hint';
    byId('form-title').textContent = p ? `Edit “${p.name}”` : 'Add a strange place';
    if (p) {
      for (const k of ['name', 'country', 'category', 'description', 'whyStrange'] as const) this.set(k, p[k]);
      this.set('lat', String(p.lat));
      this.set('lng', String(p.lng));
      this.set('zoom', String(p.zoom));
      this.set('tags', p.tags.join(', '));
      this.set('gmaps', p.googleMapsUrl);
    } else {
      this.set('category', 'other');
    }
    this.dialog.showModal();
    this.field<HTMLInputElement>(p ? 'name' : 'gmaps').focus();
  }

  private field<T extends HTMLElement>(name: string): T {
    return this.form.elements.namedItem(name) as unknown as T;
  }

  private set(name: string, v: string): void {
    (this.field<HTMLInputElement>(name)).value = v;
  }

  private get(name: string): string {
    return (this.field<HTMLInputElement>(name)).value.trim();
  }

  private applyLink(text: string): void {
    if (!text.trim()) {
      this.status.textContent = '';
      return;
    }
    const r = parseGoogleMapsUrl(text);
    if (!r.ok) {
      this.status.textContent = r.error;
      this.status.className = 'hint err';
      return;
    }
    const { lat, lng, zoom, name } = r.value;
    this.set('lat', String(roundCoord(lat)));
    this.set('lng', String(roundCoord(lng)));
    if (zoom !== null) this.set('zoom', String(zoom));
    if (name && !this.get('name')) this.set('name', name);
    this.status.textContent = `✓ Found ${roundCoord(lat)}, ${roundCoord(lng)}${zoom !== null ? ` at zoom ${zoom}` : ''}`;
    this.status.className = 'hint ok';
  }

  private submit(): void {
    const lat = roundCoord(Number(this.get('lat')));
    const lng = roundCoord(Number(this.get('lng')));
    const zoom = Math.round(Number(this.get('zoom')));
    const name = this.get('name');
    const tags = [...new Set(this.get('tags').split(',').map(slugify).filter((t) => t && t !== 'place'))].slice(0, 12);
    const place: Place = {
      id: this.editing?.id ?? this.hooks.uniqueId(slugify(name)),
      name,
      lat,
      lng,
      country: this.get('country'),
      category: this.get('category') as Category,
      description: this.get('description'),
      whyStrange: this.get('whyStrange'),
      googleMapsUrl: googleMapsUrl(lat, lng, zoom),
      zoom,
      tags,
      dateAdded: this.editing?.dateAdded ?? new Date().toISOString().slice(0, 10),
    };
    const errs = validatePlace(place);
    if (this.get('lat') === '' || this.get('lng') === '') errs.unshift('coordinates are required — paste a link or use the map centre');
    if (errs.length) {
      this.errors.textContent = `Please fix: ${errs.join('; ')}.`;
      this.errors.hidden = false;
      return;
    }
    try {
      this.hooks.save(place, !this.editing);
      this.dialog.close('saved');
    } catch (err) {
      this.errors.textContent = (err as Error).message;
      this.errors.hidden = false;
    }
  }
}
