import { CATEGORY_CODE, CATEGORY_LABEL, type Place } from '../core/place';
import { byId, h, svgIcon } from './dom';

export interface CardActions {
  onClose(): void;
  onEdit(p: Place): void;
  onDelete(p: Place): void;
  onShare(p: Place): void;
}

/** The details card shown over the map for the selected place. */
export class Card {
  private readonly el = byId('card');

  constructor(private readonly actions: CardActions) {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !this.el.hidden && !document.querySelector('dialog[open]')) actions.onClose();
    });
  }

  show(p: Place, isUserPlace: boolean): void {
    const fmt = (v: number, pos: string, neg: string) => `${Math.abs(v).toFixed(3)}°${v >= 0 ? pos : neg}`;
    const close = h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Close' }, svgIcon('i-x'));
    close.addEventListener('click', () => this.actions.onClose());
    const edit = h('button', { class: 'btn small', type: 'button' }, 'Edit');
    edit.addEventListener('click', () => this.actions.onEdit(p));
    const del = h('button', { class: 'btn small ghost danger', type: 'button' }, 'Delete');
    del.addEventListener('click', () => this.actions.onDelete(p));
    const share = h('button', { class: 'btn small ghost', type: 'button' }, 'Share');
    share.addEventListener('click', () => this.actions.onShare(p));

    const metric = (label: string, value: string, title?: string) =>
      h('div', { class: 'metric', title }, h('dt', {}, label), h('dd', {}, value));

    this.el.replaceChildren(
      h(
        'div',
        { class: 'card-head' },
        h(
          'div',
          { style: 'flex:1;min-width:0' },
          h('div', { class: 'card-kicker' }, h('i', { 'aria-hidden': 'true' }), isUserPlace ? 'Target locked · your edit' : 'Target locked'),
          h('h2', { id: 'card-title' }, p.name),
          h('div', { class: 'country' }, p.country),
        ),
        close,
      ),
      h(
        'dl',
        { class: 'metrics' },
        metric('Lat', fmt(p.lat, 'N', 'S')),
        metric('Lng', fmt(p.lng, 'E', 'W')),
        metric('Zoom', `Z${p.zoom}`),
        metric('Class', CATEGORY_CODE[p.category], CATEGORY_LABEL[p.category]),
      ),
      h('h3', {}, CATEGORY_LABEL[p.category]),
      h('p', {}, p.description),
      h('h3', {}, 'Anomaly'),
      h('p', {}, p.whyStrange),
      h('div', { class: 'tags' }, ...p.tags.map((t) => h('span', {}, `#${t}`))),
      h(
        'div',
        { class: 'card-actions' },
        h('a', { class: 'btn small primary', href: p.googleMapsUrl, target: '_blank', rel: 'noopener' }, svgIcon('i-pin'), 'Open in Google Maps'),
        share,
        edit,
        del,
      ),
    );
    this.el.setAttribute('aria-labelledby', 'card-title');
    this.el.hidden = false;
    this.el.scrollTop = 0;
  }

  /** Map area hidden by the card (px): bottom sheet on phones, left panel on desktop. */
  inset(): { left: number; right: number; bottom: number } {
    if (this.el.hidden) return { left: 0, right: 0, bottom: 0 };
    const map = this.el.parentElement!.getBoundingClientRect();
    const r = this.el.getBoundingClientRect();
    const sideBySide = r.width < map.width * 0.6;
    return sideBySide ? { left: r.right - map.left, right: 0, bottom: 0 } : { left: 0, right: 0, bottom: map.bottom - r.top };
  }

  hide(): void {
    this.el.hidden = true;
  }
}
