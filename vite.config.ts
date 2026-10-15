import { readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vitest/config';

const SITE = 'https://pavanit1217.github.io/oddatlas/';

interface SeedPlace {
  id: string;
  name: string;
  lat: number;
  lng: number;
  country: string;
  description: string;
  category: string;
}

/**
 * SEO: bake the seed catalogue into index.html at build time — a JSON-LD ItemList of
 * TouristAttractions with coordinates, and a crawlable HTML list (shown until the app boots).
 */
function seoCatalogue(): Plugin {
  return {
    name: 'oddatlas-seo-catalogue',
    transformIndexHtml(html) {
      const places = JSON.parse(readFileSync(new URL('./data/places.json', import.meta.url), 'utf8')) as SeedPlace[];
      const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: 'OddAtlas — strange places on Earth',
        numberOfItems: places.length,
        itemListElement: places.map((p, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          url: `${SITE}?place=${p.id}`,
          item: {
            '@type': 'TouristAttraction',
            name: p.name,
            description: p.description,
            address: { '@type': 'PostalAddress', addressCountry: p.country },
            geo: { '@type': 'GeoCoordinates', latitude: p.lat, longitude: p.lng },
          },
        })),
      };
      const list = places
        .map((p) => `<li><a href="?place=${p.id}"><strong>${esc(p.name)}</strong></a> — ${esc(p.country)}. ${esc(p.description)}</li>`)
        .join('\n          ');
      return html
        .replace('<!--SEO_JSONLD-->', `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>`)
        .replace('<!--SEO_LIST-->', list);
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [seoCatalogue()],
  build: { target: 'es2020', sourcemap: true },
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
});
