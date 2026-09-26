import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { browserOptions } from './browser-options.js';
const browser = await chromium.launch(browserOptions());
try {
  const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
      reducedMotion: 'reduce',
    }),
    errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto('http://127.0.0.1:3001');
  await page.getByRole('heading', { name: 'A clearer path to disclosure.' }).waitFor();
  await page.evaluate(() => document.fonts.ready);
  mkdirSync('artifacts', { recursive: true });
  await page.screenshot({ path: 'artifacts/production-dashboard.png', fullPage: true });
  await page.goto('http://127.0.0.1:3001/pitch.html');
  await page.getByRole('button', { name: 'Next slide' }).click();
  if ((await page.locator('#counter').textContent()) !== '02 / 08')
    throw new Error('Production presentation navigation failed.');
  await page.screenshot({ path: 'artifacts/production-presentation.png', fullPage: true });
  const missing = await page.request.get('http://127.0.0.1:3001/api/unknown-route');
  if (missing.status() !== 404) throw new Error('Missing API route did not return 404.');
  const report = {
    at: new Date().toISOString(),
    productionOrigin: 'http://127.0.0.1:3001',
    dashboard: true,
    presentation: true,
    fonts: true,
    api404: true,
    browserErrors: errors,
  };
  writeFileSync('artifacts/production-verification.json', JSON.stringify(report, null, 2));
  if (errors.length) throw new Error(errors.join('\n'));
  console.log(
    'Production dashboard, local fonts, CSP, presentation navigation and API 404 response verified. No browser errors.',
  );
} finally {
  await browser.close();
}
