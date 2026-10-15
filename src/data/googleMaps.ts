export interface ParsedLocation {
  lat: number;
  lng: number;
  zoom: number | null;
  /** Place name if the URL contains /place/NAME/. */
  name: string | null;
}

export type ParseResult = { ok: true; value: ParsedLocation } | { ok: false; error: string };

const valid = (lat: number, lng: number) => Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

/** Google's satellite/3D links give a view height in metres ("1234m") instead of a zoom level. */
export function metresToZoom(m: number): number {
  return Math.max(2, Math.min(21, Math.round(26.2 - Math.log2(Math.max(1, m)))));
}

/**
 * Extract coordinates from the many shapes of Google Maps links:
 *   /maps/@LAT,LNG,17z · /maps/@LAT,LNG,850m/data=!3m1!1e3 · /maps/place/Name/@LAT,LNG,15z/data=…!3dLAT!4dLNG
 *   ?q=LAT,LNG · ?ll=LAT,LNG&z=12 · /maps/search/?api=1&query=LAT,LNG · plain "LAT, LNG"
 * The pin (!3d…!4d…) wins over the viewport centre (@…) when both are present.
 */
export function parseGoogleMapsUrl(input: string): ParseResult {
  const text = input.trim();
  if (!text) return { ok: false, error: 'Paste a Google Maps link or "lat, lng".' };

  const plain = /^(-?\d{1,2}(?:\.\d+)?)\s*[,;\s]\s*(-?\d{1,3}(?:\.\d+)?)$/.exec(text);
  if (plain) {
    const lat = Number(plain[1]);
    const lng = Number(plain[2]);
    return valid(lat, lng) ? { ok: true, value: { lat, lng, zoom: null, name: null } } : { ok: false, error: 'Coordinates are out of range.' };
  }

  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return { ok: false, error: 'That is not a URL or a "lat, lng" pair.' };
  }
  if (/(^|\.)goo\.gl$|^maps\.app\.goo\.gl$/.test(url.hostname)) {
    return { ok: false, error: 'Short links (maps.app.goo.gl) can’t be expanded here — open it, then copy the full URL from the address bar.' };
  }
  if (!/(^|\.)google\.[a-z.]+$/.test(url.hostname) || !/\/maps/.test(url.pathname + url.search)) {
    return { ok: false, error: 'That does not look like a Google Maps link.' };
  }

  const full = decodeURIComponent(url.pathname + url.search + url.hash);
  const nameMatch = /\/maps\/place\/([^/@]+)/.exec(full);
  const name = nameMatch ? nameMatch[1].replace(/\+/g, ' ').trim() : null;

  let lat = NaN;
  let lng = NaN;
  let zoom: number | null = null;

  const view = /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)(?:,(\d+(?:\.\d+)?)([zm]))?/.exec(full);
  if (view) {
    lat = Number(view[1]);
    lng = Number(view[2]);
    if (view[3]) zoom = view[4] === 'z' ? Math.round(Number(view[3])) : metresToZoom(Number(view[3]));
  }
  const pin = /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/.exec(full);
  if (pin) {
    lat = Number(pin[1]);
    lng = Number(pin[2]);
  }
  if (!valid(lat, lng)) {
    for (const key of ['q', 'query', 'll', 'center', 'destination']) {
      const v = url.searchParams.get(key);
      const m = v && /^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/.exec(v);
      if (m) {
        lat = Number(m[1]);
        lng = Number(m[2]);
        break;
      }
    }
    const z = url.searchParams.get('z') ?? url.searchParams.get('zoom');
    if (z && zoom === null) zoom = Math.round(Number(z));
  }
  if (!valid(lat, lng)) return { ok: false, error: 'No coordinates found in that link. Use a link that contains “@lat,lng”.' };
  if (zoom !== null) zoom = Math.max(2, Math.min(21, zoom));
  return { ok: true, value: { lat, lng, zoom, name } };
}
