import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import { CATEGORY_ICON, type Place } from '../core/place';

const STREET_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const SATELLITE_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

/** Leaflet map with clustered place markers and a street / satellite toggle. */
export class MapView {
  readonly map: L.Map;
  private readonly street: L.TileLayer;
  private readonly satellite: L.TileLayer;
  private readonly cluster: L.MarkerClusterGroup;
  private readonly markers = new Map<string, { marker: L.Marker; place: Place; selected: boolean }>();
  private selectedId: string | null = null;

  constructor(
    el: HTMLElement,
    private readonly onSelect: (id: string) => void,
    onBackgroundClick: () => void,
  ) {
    this.street = L.tileLayer(STREET_URL, {
      maxZoom: 19,
      className: 'tiles-street',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    });
    this.satellite = L.tileLayer(SATELLITE_URL, {
      maxZoom: 19,
      maxNativeZoom: 18,
      attribution: 'Imagery &copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community',
    });
    this.map = L.map(el, {
      center: [20, 10],
      zoom: 2,
      minZoom: 2,
      worldCopyJump: true,
      zoomControl: false,
      layers: [this.street],
      tap: false,
    } as L.MapOptions);
    L.control.zoom({ position: 'topright' }).addTo(this.map);
    L.control.layers({ Map: this.street, Satellite: this.satellite }, undefined, { position: 'topright' }).addTo(this.map);
    L.control.scale({ position: 'bottomright', imperial: false }).addTo(this.map);

    this.cluster = L.markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 50,
      iconCreateFunction: (c) =>
        L.divIcon({ html: `<div class="odd-cluster">${c.getChildCount()}</div>`, className: '', iconSize: [42, 42] }),
    });
    this.map.addLayer(this.cluster);
    this.map.on('click', () => onBackgroundClick());
  }

  setPlaces(places: Place[]): void {
    this.cluster.clearLayers();
    this.markers.clear();
    const layers = places.map((p) => {
      const m = L.marker([p.lat, p.lng], {
        icon: this.icon(p, p.id === this.selectedId),
        title: p.name,
        alt: p.name,
        keyboard: true,
        riseOnHover: true,
      });
      m.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        this.onSelect(p.id);
      });
      m.on('keypress', (e) => {
        const key = (e as L.LeafletKeyboardEvent).originalEvent.key;
        if (key === 'Enter' || key === ' ') this.onSelect(p.id);
      });
      this.markers.set(p.id, { marker: m, place: p, selected: p.id === this.selectedId });
      return m;
    });
    this.cluster.addLayers(layers);
  }

  private icon(p: Place, selected: boolean): L.DivIcon {
    return L.divIcon({
      className: '',
      html: `<div class="odd-marker${selected ? ' selected' : ''}"><span>${CATEGORY_ICON[p.category]}</span></div>`,
      iconSize: [36, 36],
      iconAnchor: [4, 36],
    });
  }

  /**
   * Highlight a place, switch to satellite and fly to its suggested zoom. `inset` is the screen
   * area covered by the details card, so the place is centred in the part of the map still visible.
   */
  focus(p: Place, opts: { fly?: boolean; inset?: { right: number; bottom: number; left: number } } = {}): void {
    this.selectedId = p.id;
    this.refreshIcons();
    this.useSatellite(true);
    const place = L.latLng(p.lat, p.lng);
    const inset = opts.inset ?? { left: 0, right: 0, bottom: 0 };
    const offset = L.point((inset.right - inset.left) / 2, inset.bottom / 2);
    const target = this.map.unproject(this.map.project(place, p.zoom).add(offset), p.zoom);
    if (opts.fly === false) this.map.setView(target, p.zoom);
    else this.map.flyTo(target, p.zoom, { duration: Math.min(3.5, 1 + this.map.getCenter().distanceTo(place) / 4e6) });
  }

  clearSelection(): void {
    this.selectedId = null;
    this.refreshIcons();
  }

  private refreshIcons(): void {
    for (const [id, entry] of this.markers) {
      const sel = id === this.selectedId;
      if (entry.selected !== sel) {
        entry.selected = sel;
        entry.marker.setIcon(this.icon(entry.place, sel));
      }
    }
  }

  useSatellite(on: boolean): void {
    const [add, remove] = on ? [this.satellite, this.street] : [this.street, this.satellite];
    if (!this.map.hasLayer(add)) {
      this.map.addLayer(add);
      this.map.removeLayer(remove);
    }
  }

  center(): { lat: number; lng: number; zoom: number } {
    const c = this.map.getCenter().wrap();
    return { lat: c.lat, lng: c.lng, zoom: this.map.getZoom() };
  }

  invalidateSize(): void {
    this.map.invalidateSize();
  }
}
