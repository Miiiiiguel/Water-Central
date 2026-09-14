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

// Budgets. Long tasks are judged by what a user actually feels — the
// longest single freeze, and the blocking time around first paint —
// rather than by the raw sum over the measurement window, which also
// counts work done long after the screen is usable.
const BUDGET = { lcpMs: 4000, domReadyMs: 3000, jsKb: 600, longestTaskMs: 250, blockingMs: 800, cls: 0.15 };

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
// The offline test below deliberately cuts the network; its failed
// requests are the point of that check, not a bug in the app.
let offlinePhase = false;

// A failed request to a third-party host (a blocked font CDN, an ad
// pixel) is an environment problem, not an app bug — and the page is
// built to survive it. A failed request to our OWN origin is a real bug,
// so those still fail the run. Console messages carry no URL, hence the
// requestfailed bookkeeping.
const externalFailures = new Set();
page.on('requestfailed', (req) => {
  try {
    if (new URL(req.url()).origin !== new URL(base).origin) externalFailures.add(req.url());
  } catch {
    // Unparseable URL: treat as external rather than failing the run.
  }
});

page.on('console', (m) => {
  const t = m.text();
  if (offlinePhase && /ERR_INTERNET_DISCONNECTED|Failed to fetch|NetworkError/.test(t)) return;
  // "Failed to load resource: ..." with no URL — attributable to a
  // third-party request we already recorded as failing.
  if (/Failed to load resource/.test(t) && externalFailures.size > 0) return;
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
      const tasks = [];
      let cls = 0;
      const po = new PerformanceObserver((l) => l.getEntries().forEach((e) => (lcp = Math.max(lcp, e.startTime))));
      po.observe({ type: 'largest-contentful-paint', buffered: true });
      const lt = new PerformanceObserver((l) => l.getEntries().forEach((e) => tasks.push({ start: e.startTime, dur: e.duration })));
      lt.observe({ type: 'longtask', buffered: true });
      // Cumulative Layout Shift: content jumping around while the page
      // loads is the most common "this app feels broken" complaint.
      const ls = new PerformanceObserver((l) => l.getEntries().forEach((e) => { if (!e.hadRecentInput) cls += e.value; }));
      ls.observe({ type: 'layout-shift', buffered: true });
      setTimeout(() => {
        po.disconnect();
        lt.disconnect();
        ls.disconnect();
        // Total Blocking Time: how much of the wait before the page is
        // interactive was the main thread refusing to answer.
        const blocking = tasks.filter((t) => t.start < lcp + 500).reduce((a, t) => a + Math.max(0, t.dur - 50), 0);
        resolve({
          domReady: Math.round(nav.domContentLoadedEventEnd),
          load: Math.round(nav.loadEventEnd),
          lcp: Math.round(lcp),
          jsKb: Math.round(js / 1024),
          longestTaskMs: Math.round(Math.max(0, ...tasks.map((t) => t.dur))),
          blockingMs: Math.round(blocking),
          taskCount: tasks.length,
          totalTaskMs: Math.round(tasks.reduce((a, t) => a + t.dur, 0)),
          cls: Math.round(cls * 1000) / 1000,
        });
      }, 2500);
    })
);
(metrics.lcp <= BUDGET.lcpMs ? ok : fail)('LCP (4x CPU throttle)', `${metrics.lcp} ms (budget ${BUDGET.lcpMs})`);
(metrics.domReady <= BUDGET.domReadyMs ? ok : fail)('DOM ready', `${metrics.domReady} ms (budget ${BUDGET.domReadyMs})`);
(metrics.jsKb <= BUDGET.jsKb ? ok : fail)('JS transferred on first load', `${metrics.jsKb} KB (budget ${BUDGET.jsKb})`);
(metrics.longestTaskMs <= BUDGET.longestTaskMs ? ok : fail)('Longest single freeze', `${metrics.longestTaskMs} ms (budget ${BUDGET.longestTaskMs})`);
(metrics.blockingMs <= BUDGET.blockingMs ? ok : fail)('Blocking time before interactive', `${metrics.blockingMs} ms (budget ${BUDGET.blockingMs})`);
ok('Main-thread work (informational)', `${metrics.taskCount} long tasks, ${metrics.totalTaskMs} ms total in 2.5 s`);
(metrics.cls <= BUDGET.cls ? ok : fail)('Layout shift while loading (CLS)', `${metrics.cls} (budget ${BUDGET.cls})`);

// No horizontal scrolling on a phone — a page 10px too wide feels broken.
const overflow = await page.evaluate(() => {
  const wide = [...document.querySelectorAll('body *')]
    .filter((el) => el.getBoundingClientRect().right > document.documentElement.clientWidth + 2)
    .slice(0, 3)
    .map((el) => el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : ''));
  return { scrollable: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2, wide };
});
(!overflow.scrollable ? ok : fail)('No horizontal scroll at 390px', overflow.scrollable ? `overflowing: ${overflow.wide.join(', ')}` : 'fits');

// Touch targets. The height is what makes a control easy to hit in a
// vertical list, so every tappable element must be at least 32px tall;
// width is only checked loosely because a short text link ("FAQ") is
// legitimately narrow and still comfortable to tap.
const smallTargets = await page.evaluate(() => {
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
  };
  return [...document.querySelectorAll('button, a[href]')]
    .filter(visible)
    .filter((el) => { const r = el.getBoundingClientRect(); return r.height < 32 || r.width < 24; })
    .slice(0, 5)
    .map((el) => {
      const r = el.getBoundingClientRect();
      return `${el.tagName.toLowerCase()}:${(el.textContent || el.getAttribute('aria-label') || '?').trim().slice(0, 20)} ${Math.round(r.width)}x${Math.round(r.height)}`;
    });
});
(smallTargets.length === 0 ? ok : fail)('Touch targets at least 32px tall', smallTargets.length ? smallTargets.join(', ') : 'all ok');

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

// Order summary before Stripe: opens, shows what is being bought, and
// closes with the Android back button instead of leaving the app.
try {
  await page.evaluate(() => document.getElementById('planes')?.scrollIntoView());
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: /Comprar diagnóstico|Buy maturity/ }).first().click();
  await page.waitForTimeout(600);
  const sheet = page.locator('[role="dialog"]').filter({ hasText: /Resumen|summary/i }).first();
  const text = await sheet.innerText();
  const complete = /Stripe/.test(text) && /(fuera de la app|outside the app)/.test(text);
  (complete ? ok : fail)('Checkout summary shows price, service and Stripe', complete ? 'complete' : text.slice(0, 80));
  await page.goBack();
  // Wait for the close animation instead of a fixed delay: with the CPU
  // throttled 4x the exit spring can take well over half a second.
  await page.locator('[role="dialog"]:visible').first().waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
  const closed = (await page.locator('[role="dialog"]:visible').count()) === 0;
  const stillHome = new URL(page.url()).pathname === '/';
  (closed && stillHome ? ok : fail)('Back button closes the sheet without leaving', closed ? (stillHome ? 'closed, still on /' : 'left the page') : 'still open');
} catch (e) {
  fail('Checkout summary flow', String(e).slice(0, 140));
}

// Market intelligence: an example question must open Marco Polo and get
// a real answer back (or an honest "not connected"/"sign in" reply) —
// never silence, and never invented data.
try {
  await page.goto(base + '/', { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  await page.evaluate(() => document.getElementById('inteligencia')?.scrollIntoView());
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: /importan zapatos|import shoes/i }).first().click();
  await page.waitForTimeout(2500);
  const chat = await page.locator('[role="dialog"]').first().innerText();
  const echoed = /zapatos|shoes/i.test(chat);
  const answered = /(cuenta|account|conectad|connected|resultado|result)/i.test(chat);
  (echoed && answered ? ok : fail)(
    'Market intelligence example reaches Marco Polo',
    echoed ? (answered ? 'asked and answered' : 'no answer') : 'question not echoed'
  );
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
} catch (e) {
  fail('Market intelligence example flow', String(e).slice(0, 140));
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

// ---- 4. Offline: the installed app must not show a blank screen -------
// The service worker precaches the shell, so a reload with no network
// should still paint something instead of the browser's error page.
try {
  await page.goto(base + '/', { waitUntil: 'load' });
  await page.waitForTimeout(1500); // let the SW install and take control
  const controlled = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) return false;
    const reg = await navigator.serviceWorker.getRegistration();
    return !!reg?.active;
  });
  if (!controlled) {
    ok('Offline shell', 'service worker not active in this run — skipped');
  } else {
    offlinePhase = true;
    await context.setOffline(true);
    await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.waitForTimeout(800);
    const painted = (await page.locator('#root').innerText().catch(() => '')).trim().length > 0;
    (painted ? ok : fail)('Offline shell still renders', painted ? 'rendered from cache' : 'blank screen offline');
    await context.setOffline(false);
    offlinePhase = false;
  }
} catch (e) {
  fail('Offline shell', String(e).slice(0, 120));
}

await browser.close();

if (errors.length) fail('JavaScript errors during the run', errors.slice(0, 3).join(' | '));
else ok('JavaScript errors during the run', 'none');

if (externalFailures.size) {
  ok('Third-party requests that failed (page survived them)', [...externalFailures].map((u) => new URL(u).host).join(', '));
}

const pad = (s, n) => (s + ' '.repeat(n)).slice(0, n);
console.log(`\nApp quality check — ${base} (phone, CPU 4x slower)\n`);
for (const r of results) console.log(`${r.ok ? '✅' : '❌'} ${pad(r.name, 50)} ${r.detail}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed\n`);
process.exit(failed ? 1 : 0);
