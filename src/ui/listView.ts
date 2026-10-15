import { CATEGORIES, CATEGORY_ICON, CATEGORY_LABEL, type Category, type Place } from '../core/place';
import { type Query, type SortKey, filterPlaces, tagCounts } from '../data/query';
import { byId, h } from './dom';

const MAX_TAG_CHIPS = 24;

/** Search box, category/tag filters, sort and the results list. */
export class ListView {
  private readonly q = byId<HTMLInputElement>('q');
  private readonly category = byId<HTMLSelectElement>('f-category');
  private readonly sort = byId<HTMLSelectElement>('f-sort');
  private readonly chips = byId('tag-chips');
  private readonly list = byId<HTMLOListElement>('place-list');
  private readonly count = byId('result-count');
  private readonly tags = new Set<string>();
  private places: Place[] = [];
  private selectedId: string | null = null;

  constructor(
    private readonly onPick: (id: string) => void,
    private readonly mapCenter: () => { lat: number; lng: number },
    private readonly isUserPlace: (id: string) => boolean,
  ) {
    for (const c of CATEGORIES) this.category.append(h('option', { value: c }, `${CATEGORY_ICON[c]} ${CATEGORY_LABEL[c]}`));
    this.q.addEventListener('input', () => this.render());
    this.category.addEventListener('change', () => this.render());
    this.sort.addEventListener('change', () => this.render());
  }

  setPlaces(places: Place[]): void {
    this.places = places;
    // Drop selected tags that no longer exist.
    const all = new Set(places.flatMap((p) => p.tags));
    for (const t of [...this.tags]) if (!all.has(t)) this.tags.delete(t);
    this.renderChips();
    this.render();
  }

  setSelected(id: string | null): void {
    this.selectedId = id;
    this.list.querySelectorAll('.place-item').forEach((el) => el.setAttribute('aria-current', String(el.getAttribute('data-id') === id)));
  }

  query(): Query {
    return {
      text: this.q.value,
      category: this.category.value as Category | '',
      tags: [...this.tags],
      sort: this.sort.value as SortKey,
      near: this.mapCenter(),
    };
  }

  private renderChips(): void {
    this.chips.replaceChildren(
      ...tagCounts(this.places)
        .slice(0, MAX_TAG_CHIPS)
        .map(([tag, n]) => {
          const b = h('button', { class: 'chip', type: 'button', 'aria-pressed': String(this.tags.has(tag)) }, `#${tag} · ${n}`);
          b.addEventListener('click', () => {
            if (this.tags.has(tag)) this.tags.delete(tag);
            else this.tags.add(tag);
            b.setAttribute('aria-pressed', String(this.tags.has(tag)));
            this.render();
          });
          return b;
        }),
    );
  }

  render(): void {
    const results = filterPlaces(this.places, this.query());
    this.count.textContent = `${results.length} of ${this.places.length} places`;
    this.list.replaceChildren(
      ...results.map((p) => {
        const item = h(
          'button',
          { class: 'place-item', type: 'button', 'data-id': p.id, 'aria-current': String(p.id === this.selectedId) },
          h('span', { class: 'badge', 'aria-hidden': 'true' }, CATEGORY_ICON[p.category]),
          h(
            'span',
            {},
            h('h3', {}, p.name),
            h('span', { class: 'meta' }, `${p.country} · ${CATEGORY_LABEL[p.category]}`, this.isUserPlace(p.id) ? h('span', { class: 'mine' }, ' · yours') : null),
            h('p', {}, p.description),
          ),
        );
        item.addEventListener('click', () => this.onPick(p.id));
        return h('li', {}, item);
      }),
    );
    if (!results.length) this.list.append(h('li', { class: 'result-count' }, 'Nothing matches — try fewer filters.'));
  }
}
