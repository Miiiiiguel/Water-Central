#!/usr/bin/env node
// App quality check: what a user with a mid-range phone experiences.
//
//   pnpm test:app                      # against http://localhost:3000
//   pnpm test:app https://easycomex.com
//
// Emulates a 390x844 phone with the CPU throttled 4x, then:
//   1. measures first-load metrics on the home page (LCP, DOM ready,
//      JS transferred, long tasks);
//   2. visits every route and drives the main flows (Marco Polo chat,
//      freight form, language toggle) asserting zero JS errors.
// Exit code 1 on any error or if a budget is blown, so CI can gate on it.

import fs from 'node:fs';

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  ({ chromium } = await import('/opt/node22/lib/node_modules/playwright/index.mjs'));
}

const base = (process.argv[2] || 'http://localhost:3000').replace(/\/$/, '');
const executablePath = process.env.CHROMIUM_PATH || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);

const BUDGET = { lcpMs: 4000, domReadyMs: 3000, jsKb: 600, longTaskMs: 1500 };

const browser = await chromium.launch({ executablePath });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  userAgent: 'Mozilla/5.0 (Linux; Android 12; Pixel 6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36',
});
const page = await context.newPage();
const cdp = await context.newCDPSession(page);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });

const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${String(e).slice(0, 200)}`));
page.on('console', (m) => {
  const t = m.text();
  if (m.type() === 'error' && !/ERR_CONNECTION_RESET|fonts\.g|status of (503|429)/.test(t)) errors.push(`console: ${t.slice(0, 200)}`);
});

const results = [];
const ok = (name, detail) => results.push({ ok: true, name, detail });
const fail = (name, detail) => results.push({ ok: false, name, detail });

// ---- 1. First load metrics -------------------------------------------
await page.goto(base + '/', { waitUntil: 'load' });
const metrics = await page.evaluate(
  () =>
    new Promise((resolve) => {
      const nav = performance.getEntriesByType('navigation')[0];
      const js = performance
        .getEntriesByType('resource')
        .filter((r) => /\.js(\?|$)/.test(r.name))
        .reduce((a, r) => a + (r.transferSize || r.encodedBodySize || 0), 0);
      let lcp = 0;
      let longTask = 0;
      const po = new PerformanceObserver((l) => l.getEntries().forEach((e) => (lcp = Math.max(lcp, e.startTime))));
      po.observe({ type: 'largest-contentful-paint', buffered: true });
      const lt = new PerformanceObserver((l) => l.getEntries().forEach((e) => (longTask += e.duration)));
      lt.observe({ type: 'longtask', buffered: true });
      setTimeout(() => {
        po.disconnect();
        lt.disconnect();
        resolve({ domReady: Math.round(nav.domContentLoadedEventEnd), load: Math.round(nav.loadEventEnd), lcp: Math.round(lcp), jsKb: Math.round(js / 1024), longTaskMs: Math.round(longTask) });
      }, 2500);
    })
);
(metrics.lcp <= BUDGET.lcpMs ? ok : fail)('LCP (4x CPU throttle)', `${metrics.lcp} ms (budget ${BUDGET.lcpMs})`);
(metrics.domReady <= BUDGET.domReadyMs ? ok : fail)('DOM ready', `${metrics.domReady} ms (budget ${BUDGET.domReadyMs})`);
(metrics.jsKb <= BUDGET.jsKb ? ok : fail)('JS transferred on first load', `${metrics.jsKb} KB (budget ${BUDGET.jsKb})`);
(metrics.longTaskMs <= BUDGET.longTaskMs ? ok : fail)('Main-thread long tasks', `${metrics.longTaskMs} ms (budget ${BUDGET.longTaskMs})`);

// ---- 2. Flows on the home page ----------------------------------------
try {
  await page.getByRole('button', { name: /Marco Polo/ }).first().click();
  await page.waitForTimeout(500);
  await page.getByPlaceholder(/Marco Polo/).fill('cuanto cuesta');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1500);
  const replied = (await page.locator('[role="dialog"]').innerText()).includes('6.90');
  (replied ? ok : fail)('Marco Polo answers a pricing question', replied ? 'replied' : 'no reply');
  await page.keyboard.press('Escape');
} catch (e) {
  fail('Marco Polo flow', String(e).slice(0, 120));
}

try {
  await page.evaluate(() => document.getElementById('calculadora')?.scrollIntoView());
  await page.waitForTimeout(500);
  await page.fill('input[name="origin"]', 'Bogotá');
  await page.fill('input[name="destination"]', 'Miami');
  const emailField = page.locator('input[name="email"]').first();
  if (await emailField.count()) await emailField.fill('qa@example.com');
  await page.fill('input[name="weight"]', '20');
  await page.getByRole('button', { name: /Calcular|Calculate/ }).click();
  await page.waitForTimeout(1500);
  const done = (await page.getByText(/recibimos|received|enviad|sent|Gracias|Thank|Intenta|try again/i).count()) > 0;
  (done ? ok : fail)('Freight form submits (or reports an error cleanly)', done ? 'handled' : 'no feedback shown');
} catch (e) {
  fail('Freight form flow', String(e).slice(0, 120));
}

try {
  await page.getByLabel(/Cambiar a Español|Switch to English/).first().click();
  await page.waitForTimeout(400);
  ok('Language toggle', await page.getAttribute('html', 'lang'));
} catch (e) {
  fail('Language toggle', String(e).slice(0, 120));
}

// ---- 3. Every route renders without JS errors -------------------------
for (const route of ['/login', '/registro', '/dashboard', '/restablecer', '/privacidad', '/terminos', '/pago/exito', '/pago/cancelado', '/no-existe-404']) {
  const before = errors.length;
  try {
    await page.goto(base + route, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(700);
    const text = (await page.locator('#root').innerText()).trim();
    if (!text) fail(`Route ${route}`, 'rendered empty');
    else if (errors.length > before) fail(`Route ${route}`, errors.slice(before).join(' | ').slice(0, 160));
    else ok(`Route ${route}`, `${text.length} chars`);
  } catch (e) {
    fail(`Route ${route}`, String(e).slice(0, 120));
  }
}

await browser.close();

if (errors.length) fail('JavaScript errors during the run', errors.slice(0, 3).join(' | '));
else ok('JavaScript errors during the run', 'none');

const pad = (s, n) => (s + ' '.repeat(n)).slice(0, n);
console.log(`\nApp quality check — ${base} (phone, CPU 4x slower)\n`);
for (const r of results) console.log(`${r.ok ? '✅' : '❌'} ${pad(r.name, 50)} ${r.detail}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed\n`);
process.exit(failed ? 1 : 0);
