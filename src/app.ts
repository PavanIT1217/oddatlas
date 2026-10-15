import seed from '../data/places.json';
import type { Place } from './core/place';
import { pickRandom } from './data/query';
import { Catalogue, parseImport } from './data/store';
import { MapView } from './map/mapView';
import { saveTextFile, shareLink } from './platform/files';
import { Card } from './ui/card';
import { byId, toast } from './ui/dom';
import { PlaceForm } from './ui/form';
import { ListView } from './ui/listView';
import { initTheme } from './ui/theme';

type View = 'map' | 'list';
const DESKTOP = matchMedia('(min-width: 960px)');

/** Wires the catalogue, map, list, card and dialogs together. */
export class App {
  private readonly catalogue = new Catalogue(seed as Place[]);
  private readonly map: MapView;
  private readonly list: ListView;
  private readonly card: Card;
  private readonly form: PlaceForm;
  private selected: Place | null = null;
  private lastRandom: Place | undefined;

  constructor() {
    this.map = new MapView(byId('map'), (id) => this.select(id), () => this.deselect());
    this.list = new ListView(
      (id) => {
        this.setView('map');
        this.select(id);
      },
      () => this.map.center(),
      (id) => this.catalogue.isModified(id),
    );
    this.card = new Card({
      onClose: () => this.deselect(),
      onEdit: (p) => this.form.open(p),
      onDelete: (p) => this.remove(p),
      onShare: (p) => void this.share(p),
    });
    this.form = new PlaceForm({
      mapCenter: () => this.map.center(),
      uniqueId: (base) => this.catalogue.uniqueId(base),
      save: (p, isNew) => {
        if (isNew) this.catalogue.add(p);
        else this.catalogue.update(p);
        toast(isNew ? `Added “${p.name}”` : `Saved “${p.name}”`);
        this.select(p.id);
      },
    });
    this.catalogue.subscribe(() => this.refresh());
    this.bindChrome();
    this.refresh();
  }

  start(): void {
    const id = new URLSearchParams(location.search).get('place');
    if (id && this.catalogue.get(id)) this.select(id, false);
  }

  private refresh(): void {
    const all = this.catalogue.all();
    this.map.setPlaces(all);
    this.list.setPlaces(all);
    if (this.selected) {
      const fresh = this.catalogue.get(this.selected.id);
      if (fresh) {
        this.selected = fresh;
        this.card.show(fresh, this.catalogue.isModified(fresh.id));
      } else this.deselect();
    }
  }

  private select(id: string, fly = true): void {
    const p = this.catalogue.get(id);
    if (!p) return;
    this.selected = p;
    if (!DESKTOP.matches) this.setView('map');
    this.card.show(p, this.catalogue.isModified(p.id));
    this.map.focus(p, { fly, inset: this.card.inset() });
    this.list.setSelected(p.id);
    const url = new URL(location.href);
    url.searchParams.set('place', p.id);
    history.replaceState(null, '', url);
    document.title = `${p.name} — OddAtlas`;
  }

  private deselect(): void {
    this.selected = null;
    this.card.hide();
    this.map.clearSelection();
    this.list.setSelected(null);
    const url = new URL(location.href);
    url.searchParams.delete('place');
    history.replaceState(null, '', url);
    document.title = 'OddAtlas — Strange & Surprising Places on Earth, on a Map';
  }

  private remove(p: Place): void {
    const note = this.catalogue.isSeed(p.id) ? ' You can bring it back with “Reset to original list”.' : '';
    if (!confirm(`Delete “${p.name}” from your atlas?${note}`)) return;
    this.catalogue.remove(p.id);
    this.deselect();
    toast(`Deleted “${p.name}”`);
  }

  private async share(p: Place): Promise<void> {
    const url = new URL(location.href);
    url.search = `?place=${p.id}`;
    const r = await shareLink(p.name, url.toString());
    if (r === 'copied') toast('Link copied');
    else if (r === 'failed') toast('Could not share this link');
  }

  private random(): void {
    const p = pickRandom(this.catalogue.all(), Math.random, this.lastRandom);
    if (!p) return;
    this.lastRandom = p;
    this.select(p.id);
  }

  private setView(view: View): void {
    document.body.dataset.view = view;
    document.querySelectorAll<HTMLButtonElement>('.bottom-nav [data-view]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === view)));
    if (view === 'map') requestAnimationFrame(() => this.map.invalidateSize());
  }

  private bindChrome(): void {
    document.querySelectorAll<HTMLButtonElement>('.bottom-nav [data-view]').forEach((b) =>
      b.addEventListener('click', () => this.setView(b.dataset.view as View)),
    );
    byId('btn-add').addEventListener('click', () => this.form.open());
    byId('btn-add-top').addEventListener('click', () => this.form.open());
    byId('btn-random').addEventListener('click', () => this.random());

    const menu = byId('menu');
    const menuBtn = byId<HTMLButtonElement>('btn-menu');
    const setMenu = (open: boolean) => {
      menu.hidden = !open;
      menuBtn.setAttribute('aria-expanded', String(open));
      if (open) menu.querySelector<HTMLButtonElement>('button')?.focus();
    };
    menuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      setMenu(menu.hidden);
    });
    document.addEventListener('click', (e) => {
      if (!menu.hidden && !menu.contains(e.target as Node)) setMenu(false);
    });
    menu.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        setMenu(false);
        menuBtn.focus();
      }
    });

    const cycleTheme = initTheme(byId('theme-name'));
    const fileInput = byId<HTMLInputElement>('import-file');
    menu.addEventListener('click', (e) => {
      const action = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-action]')?.dataset.action;
      if (!action) return;
      if (action === 'theme') {
        cycleTheme();
        return; // keep the menu open so the label change is visible
      }
      setMenu(false);
      if (action === 'export') void this.exportCatalogue();
      if (action === 'import') fileInput.click();
      if (action === 'about') byId<HTMLDialogElement>('about-dialog').showModal();
      if (action === 'reset' && confirm('Remove all your additions, edits and deletions and go back to the original list?')) {
        this.catalogue.reset();
        toast('Back to the original list');
      }
    });

    fileInput.addEventListener('change', async () => {
      const file = fileInput.files?.[0];
      fileInput.value = '';
      if (file) await this.importFile(file);
    });

    DESKTOP.addEventListener('change', () => this.map.invalidateSize());
  }

  private async exportCatalogue(): Promise<void> {
    const date = new Date().toISOString().slice(0, 10);
    await saveTextFile(`oddatlas-${date}.json`, this.catalogue.exportJson());
    toast(`Exported ${this.catalogue.all().length} places`);
  }

  private async importFile(file: File): Promise<void> {
    const { places, errors } = parseImport(await file.text());
    if (!places.length) {
      toast(errors[0] ?? 'No places found in that file', 5000);
      return;
    }
    const dialog = byId<HTMLDialogElement>('import-dialog');
    byId('import-summary').textContent =
      `${file.name} contains ${places.length} valid place${places.length === 1 ? '' : 's'}` +
      (errors.length ? ` (${errors.length} invalid entr${errors.length === 1 ? 'y' : 'ies'} will be skipped)` : '') +
      '. Merge them into your atlas, or replace your atlas with this file?';
    dialog.returnValue = '';
    dialog.showModal();
    dialog.addEventListener(
      'close',
      () => {
        const mode = dialog.returnValue;
        if (mode !== 'merge' && mode !== 'replace') return;
        const r = this.catalogue.import(places, mode);
        toast(`Imported: ${r.added} added, ${r.updated} updated, ${r.unchanged} unchanged${mode === 'replace' ? `, ${r.removed} removed` : ''}`, 4500);
      },
      { once: true },
    );
  }
}
