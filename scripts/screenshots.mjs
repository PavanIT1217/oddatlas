// Captures README / store screenshots. Run after `npm run build`.
import { mkdir } from 'node:fs/promises';
import { preview } from 'vite';
import { chromium } from 'playwright-core';

const server = await preview({ preview: { port: 4194, strictPort: true }, logLevel: 'silent' });
const base = 'http://localhost:4194/';
// Pass any HTTPS proxy straight to Chromium so the local preview server bypasses it.
const proxyArgs = process.env.HTTPS_PROXY ? [`--proxy-server=${process.env.HTTPS_PROXY}`, '--proxy-bypass-list=localhost;127.0.0.1'] : [];
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: proxyArgs,
});
await mkdir('docs/screenshots', { recursive: true });
await mkdir('public/screenshots', { recursive: true });

async function shot({ name, query = '', width = 1440, height = 900, dpr = 1, mobile = false, scheme = 'light', wait = 5000, before }) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr, isMobile: mobile, hasTouch: mobile, colorScheme: scheme });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(base + query);
  await page.waitForTimeout(wait);
  if (before) await before(page);
  for (const path of [].concat(name)) await page.screenshot({ path });
  console.log('wrote', name, errors.length ? errors : '');
  await ctx.close();
}

const phone = { width: 390, height: 844, dpr: 2, mobile: true };

await shot({ name: ['docs/screenshots/desktop-map.png', 'public/screenshots/desktop.png'] });
await shot({ name: 'docs/screenshots/desktop-place.png', query: '?place=richat-structure', wait: 7000 });
await shot({ name: ['docs/screenshots/mobile-map.png', 'public/screenshots/mobile.png'], ...phone });
await shot({ name: 'docs/screenshots/mobile-card.png', query: '?place=great-blue-hole', ...phone, wait: 7000 });
await shot({
  name: 'docs/screenshots/mobile-list.png',
  ...phone,
  wait: 2500,
  before: async (page) => {
    await page.click('.bottom-nav [data-view="list"]');
    await page.click('#tag-chips .chip');
    await page.waitForTimeout(400);
  },
});
await shot({
  name: 'docs/screenshots/mobile-daylight.png',
  query: '?place=lake-hillier',
  ...phone,
  wait: 7000,
  before: async (page) => {
    await page.evaluate(() => {
      localStorage.setItem('oddatlas:theme', 'light');
      document.documentElement.dataset.theme = 'light';
    });
    await page.waitForTimeout(600);
  },
});
await shot({
  name: 'docs/screenshots/mobile-add.png',
  ...phone,
  wait: 2500,
  before: async (page) => {
    await page.click('#btn-add');
    await page.fill('input[name="gmaps"]', 'https://www.google.com/maps/place/Badwater+Basin/@36.2297,-116.7676,15z/data=!3m1!1e3');
    await page.waitForTimeout(300);
  },
});
await shot({ name: 'public/og-image.png', query: '?place=grand-prismatic-spring', width: 1200, height: 630, wait: 7000 });

await browser.close();
await server.close();
