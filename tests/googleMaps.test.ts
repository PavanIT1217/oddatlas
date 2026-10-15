import { describe, expect, it } from 'vitest';
import { metresToZoom, parseGoogleMapsUrl } from '../src/data/googleMaps';

const ok = (input: string) => {
  const r = parseGoogleMapsUrl(input);
  if (!r.ok) throw new Error(r.error);
  return r.value;
};

describe('parseGoogleMapsUrl', () => {
  it('reads the canonical @lat,lng,zoomz form', () => {
    expect(ok('https://www.google.com/maps/@21.124,-11.4017,11z')).toEqual({ lat: 21.124, lng: -11.4017, zoom: 11, name: null });
  });

  it('converts satellite "metres" views to a zoom level', () => {
    const v = ok('https://www.google.com/maps/@40.2525604,58.4396612,620m/data=!3m1!1e3?entry=ttu');
    expect(v.lat).toBeCloseTo(40.2525604, 7);
    expect(v.zoom).toBe(metresToZoom(620));
    expect(metresToZoom(1000)).toBe(16);
    expect(metresToZoom(1e9)).toBe(2);
  });

  it('prefers the pin (!3d!4d) over the viewport centre and extracts the place name', () => {
    const v = ok(
      'https://www.google.com/maps/place/Spiral+Jetty/@41.4402,-112.6727,15z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d41.4375!4d-112.66894',
    );
    expect(v).toMatchObject({ lat: 41.4375, lng: -112.66894, zoom: 15, name: 'Spiral Jetty' });
  });

  it('handles query-style links', () => {
    expect(ok('https://www.google.com/maps?q=17.3157,-87.5346&z=14')).toMatchObject({ lat: 17.3157, lng: -87.5346, zoom: 14 });
    expect(ok('https://www.google.com/maps/search/?api=1&query=-34.0951%2C123.2027')).toMatchObject({ lat: -34.0951, lng: 123.2027 });
    expect(ok('https://maps.google.co.uk/maps?ll=51.5777,-1.5666&z=17')).toMatchObject({ lat: 51.5777, lng: -1.5666, zoom: 17 });
  });

  it('accepts plain "lat, lng"', () => {
    expect(ok('-14.69207, -75.14888')).toMatchObject({ lat: -14.69207, lng: -75.14888, zoom: null });
    expect(ok('53.00694 7.19194')).toMatchObject({ lat: 53.00694, lng: 7.19194 });
  });

  it('decodes URL-encoded names', () => {
    expect(ok('https://www.google.com/maps/place/Gale%C5%A1njak/@43.978,15.3825,16z').name).toBe('Galešnjak');
  });

  it('rejects short links, other sites and nonsense with helpful messages', () => {
    const short = parseGoogleMapsUrl('https://maps.app.goo.gl/AbCdEf');
    expect(short.ok).toBe(false);
    if (!short.ok) expect(short.error).toMatch(/Short links/);
    expect(parseGoogleMapsUrl('https://example.com/maps/@1,2,3z').ok).toBe(false);
    expect(parseGoogleMapsUrl('hello').ok).toBe(false);
    expect(parseGoogleMapsUrl('').ok).toBe(false);
    expect(parseGoogleMapsUrl('95, 10').ok).toBe(false);
    expect(parseGoogleMapsUrl('https://www.google.com/maps/dir/').ok).toBe(false);
  });
});
