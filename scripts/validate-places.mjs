// Validates data/places.json against schema/place.schema.json (JSON Schema 2020-12, via Ajv),
// plus catalogue-level rules: unique ids, Google Maps links matching lat/lng/zoom, no near-duplicates.
// Run: npm run validate   (also runs in CI and before every build)
import { readFile } from 'node:fs/promises';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const schema = JSON.parse(await readFile(new URL('../schema/place.schema.json', import.meta.url), 'utf8'));
const file = process.argv[2] ?? new URL('../data/places.json', import.meta.url);
let places;
try {
  places = JSON.parse(await readFile(file, 'utf8'));
} catch (err) {
  console.error(`✗ ${file} is not valid JSON: ${err.message}`);
  process.exit(1);
}

const ajv = new Ajv({ allErrors: true, strict: true });
addFormats(ajv);
const validate = ajv.compile(schema);
const errors = [];
if (!validate(places)) {
  for (const e of validate.errors) errors.push(`${e.instancePath || '/'} ${e.message}${e.params?.allowedValues ? `: ${e.params.allowedValues.join(', ')}` : ''}`);
}

if (Array.isArray(places)) {
  const ids = new Map();
  places.forEach((p, i) => {
    if (ids.has(p.id)) errors.push(`/${i} duplicate id "${p.id}" (also at /${ids.get(p.id)})`);
    ids.set(p.id, i);
    const m = /@(-?[\d.]+),(-?[\d.]+),(\d+)z$/.exec(p.googleMapsUrl ?? '');
    if (m && (Math.abs(+m[1] - p.lat) > 1e-4 || Math.abs(+m[2] - p.lng) > 1e-4 || +m[3] !== p.zoom)) {
      errors.push(`/${i} (${p.id}) googleMapsUrl does not match lat/lng/zoom`);
    }
    if (p.dateAdded && new Date(p.dateAdded) > new Date(Date.now() + 86_400_000)) errors.push(`/${i} (${p.id}) dateAdded is in the future`);
  });
  // Two entries within ~50 m are almost certainly the same place.
  for (let i = 0; i < places.length; i++) {
    for (let j = i + 1; j < places.length; j++) {
      const a = places[i];
      const b = places[j];
      const dy = (a.lat - b.lat) * 111_195;
      const dx = (a.lng - b.lng) * 111_195 * Math.cos((a.lat * Math.PI) / 180);
      if (Math.hypot(dx, dy) < 50) errors.push(`/${i} (${a.id}) and /${j} (${b.id}) are within 50 m of each other`);
    }
  }
}

if (errors.length) {
  console.error(`✗ ${errors.length} problem(s) in places.json:\n  ${errors.join('\n  ')}`);
  process.exit(1);
}
console.log(`✓ places.json is valid (${places.length} places)`);
