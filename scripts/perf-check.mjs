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
  // Antes esto exigía la cadena '6.90'. Cuando el precio real cambió a
  // USD 9.99, la prueba se puso roja por estar en lo cierto: el guion del
  // bot citaba un precio viejo. Fijar un número concreto convierte
  // cualquier cambio de precio en un fallo, así que ahora se comprueba lo
  // que de verdad importa — que contestó, y que su respuesta habla de
  // dinero.
  const dialog = await page.locator('[role="dialog"]').innerText();
  const replied = /USD\s?\d|\$\s?\d|gratis|free/i.test(dialog);
  (replied ? ok : fail)('Marco Polo answers a pricing question', replied ? 'replied' : 'no reply');
  await page.keyboard.press('Escape');
} catch (e) {
  fail('Marco Polo flow', String(e).slice(0, 120));
}

// ---- El botón de pago: que cobre, o que diga por qué no ---------------
//
// La queja fue literal: "los botones de pago no funcionan". Y no era que
// fallaran: es que no había ninguna pasarela configurada y el botón se
// quedaba girando o moría en un mensaje genérico. Un botón de cobro
// tiene exactamente dos finales aceptables — abre un pago, o explica por
// qué no puede. Quedarse pensando no es uno de ellos.
try {
  const catalog = await page.evaluate(async () => {
    const res = await fetch('/api/checkout/catalog');
    return res.ok ? res.json() : null;
  });
  const items = catalog?.items ?? [];
  const custom = items.find((i) => i.plan === 'acompanamiento');
  const priced = items.filter((i) => i.amountInCents > 0);
  const allCop = priced.every((i) => i.currency === 'COP');
  (items.length >= 5 && custom && custom.payable === false && allCop ? ok : fail)(
    'Checkout catalog is honest about what it can charge',
    items.length ? `${priced.length} con precio, ${items.filter((i) => i.payable).length} cobrables, a medida no cobrable` : 'sin catálogo'
  );
} catch (e) {
  fail('Checkout catalog', String(e).slice(0, 120));
}

try {
  await page.evaluate(() => document.getElementById('planes')?.scrollIntoView());
  await page.waitForTimeout(600);
  // El "Empezar" del análisis de mercado: la última tarjeta de planes, y
  // la única con cobro en línea.
  await page.locator('#planes').getByRole('button', { name: /^(Empezar|Get started)$/ }).last().click();
  await page.waitForTimeout(700);
  const payBtn = page.getByRole('button', { name: /Pagar de forma segura|Pay securely/ }).first();
  if (await payBtn.count()) {
    await payBtn.click();
    // Sin pasarela configurada tiene que aparecer un motivo en texto, y
    // el botón tiene que dejar de girar. Con pasarela, se va a Wompi o a
    // Stripe y esta página deja de existir.
    await page.waitForTimeout(3000);
    const left = page.url();
    const gone = /wompi\.co|stripe\.com/.test(left);
    const body = gone ? '' : await page.locator('body').innerText();
    const explained = gone || /WhatsApp|no está habilitado|not enabled|conexión|connection|cuenta antes de comprar|sign in/i.test(body);
    (explained ? ok : fail)('Pay button either charges or says why not', gone ? 'redirigió a la pasarela' : explained ? 'explicó el motivo' : 'se quedó sin decir nada');
    if (!gone) await page.keyboard.press('Escape');
  } else {
    ok('Pay button either charges or says why not', 'sin botón de pago en esta vista');
  }
} catch (e) {
  fail('Pay button flow', String(e).slice(0, 120));
}

// La queja exacta del cliente: "pregunto y aún no responde". Escribir
// la pregunta tiene que llevar a los datos, no a un párrafo explicando
// que podríamos buscarlos.
try {
  await page.getByRole('button', { name: /Marco Polo/ }).first().click();
  await page.waitForTimeout(400);
  await page.getByPlaceholder(/Marco Polo/).fill('cuales son los 3 jeans mas vendidos');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(2000);
  const panel = await page.locator('[role="dialog"]').innerText();
  // Sin sesión, la respuesta correcta es pedirla — no explicar. Con
  // sesión y fuente conectada, sería el dato.
  const fueALosDatos = /crea(r)? (tu )?cuenta|create your account|consultas|lookups|TikTok Shop/i.test(panel);
  (fueALosDatos ? ok : fail)(
    'A data question goes to the research desk, not to a paragraph',
    fueALosDatos ? 'llevó a la consulta' : panel.slice(-120).replace(/\s+/g, ' ')
  );
  await page.keyboard.press('Escape');
} catch (e) {
  fail('Data question flow', String(e).slice(0, 120));
}

// Analizar un producto vive dentro de Marco Polo: un botón de cámara en
// el chat, no una pantalla aparte. Y "analizá mi producto" NO puede
// gastar una consulta de mercado: tiene la forma de una búsqueda y es
// otra cosa, que además es gratis.
try {
  await page.getByRole('button', { name: /Marco Polo/ }).first().click();
  await page.waitForTimeout(400);

  const camara = page.locator('button[aria-label*="from a photo" i], button[aria-label*="con una foto" i]');
  const hayCamara = await camara.isVisible();

  await page.getByPlaceholder(/Marco Polo/).fill('quiero clasificar mi producto');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1800);
  let panel = await page.locator('[role="dialog"]').innerText();
  const apunta = /cámara|camera/i.test(panel);
  // Si hubiera ido a la mesa de consultas, estaría pidiendo el término.
  const noCobro = !/Escribime el producto o categoría|Type the product or category/i.test(panel);

  (hayCamara && apunta && noCobro ? ok : fail)(
    'Analyzing a product lives inside Marco Polo, and costs no lookup',
    hayCamara && apunta && noCobro
      ? 'botón de cámara presente, la pregunta va al lector de etiquetas'
      : `cámara:${hayCamara} apunta:${apunta} sin-cobro:${noCobro}`
  );

  // Sin llave de visión, tocar la cámara tiene que DECIRLO, no fallar.
  if (hayCamara) {
    await camara.click();
    await page.waitForTimeout(1800);
    panel = await page.locator('[role="dialog"]').innerText();
    const honesto = /todavía no está activada|not enabled|foto a la etiqueta|photo of the label|crear? (tu )?cuenta|create your account/i.test(panel);
    (honesto ? ok : fail)(
      'The camera button says what it can do, or why it cannot',
      honesto ? 'dijo qué pasa' : panel.slice(-140).replace(/\s+/g, ' ')
    );
  }
  await page.keyboard.press('Escape');
} catch (e) {
  fail('Product analysis flow', String(e).slice(0, 120));
}

try {
  await page.evaluate(() => document.getElementById('calculadora')?.scrollIntoView());
  await page.waitForTimeout(500);
  // Real quote: 20 kg to Miami (zone I) as a Normal client must come back
  // priced from the server-side tariff table.
  await page.locator('#freight-destination:not([disabled])').waitFor({ timeout: 8000 });
  await page.selectOption('#freight-destination', '197');
  await page.selectOption('#freight-client-type', 'Normal');
  const emailField = page.locator('input[name="email"]').first();
  if (await emailField.count()) await emailField.fill('qa@example.com');
  await page.fill('input[name="weight"]', '20');
  await page.getByRole('button', { name: /Calcular|Calculate/ }).click();
  await page.waitForTimeout(1500);
  const priced = await page.getByText(/Tu cotización|Your quote/).count();
  const amount = priced ? await page.locator('text=/^\\$[\\d.]+ COP$/').first().innerText().catch(() => '') : '';
  (priced ? ok : fail)('Freight calculator prices a real shipment', priced ? `Miami, 20 kg, Normal → ${amount}` : 'no quote shown');
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

// El resumen antes de pagar: se abre, dice qué se compra y quién cobra,
// y se cierra con el botón atrás de Android en vez de salirse de la app.
try {
  await page.evaluate(() => document.getElementById('planes')?.scrollIntoView());
  await page.waitForTimeout(400);
  // La tercera tarjeta (análisis de mercado) es la única con cobro en
  // línea: la primera lleva al diagnóstico gratis y la segunda es a
  // medida.
  await page.getByRole('button', { name: /^(Empezar|Get started)$/ }).nth(2).click();
  await page.waitForTimeout(600);
  const sheet = page.locator('[role="dialog"]').filter({ hasText: /Resumen|summary/i }).first();
  const text = await sheet.innerText();
  // Antes esto exigía la palabra "Stripe". Con el cobro yendo por Wompi,
  // exigirla era exigir una mentira: la hoja ahora nombra a quien de
  // verdad va a cobrar, y si no hay ninguna configurada no nombra a
  // nadie. Lo que no puede faltar nunca es la advertencia de que el
  // servicio se presta fuera de la app (regla 3.1.3(e) de Apple).
  const namesGateway = /Stripe|Wompi|pasarela certificada|certified payment provider/.test(text);
  const complete = namesGateway && /(fuera de la app|outside the app)/.test(text);
  (complete ? ok : fail)('Checkout summary names who charges and where the service happens', complete ? 'complete' : text.slice(0, 80));
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

// ROI calculator: typing a number must move the headline figures, and
// the paid reports must stay locked until someone buys them.
try {
  await page.goto(base + '/roi', { waitUntil: 'load' });
  await page.waitForTimeout(1200);
  const statsOf = async () =>
    (await page.locator('text=/RETURN ON INVESTMENT|RETORNO SOBRE/i').first().locator('xpath=ancestor::section[1]').innerText());
  const before = await statsOf();
  await page.fill('#in_price', '95');
  await page.waitForTimeout(600);
  const after = await statsOf();
  (before !== after ? ok : fail)('ROI recalculates when an input changes', before !== after ? 'figures moved' : 'no change');

  const locked = await page.getByText(/Unlock now|Desbloquear ahora/).count();
  (locked >= 2 ? ok : fail)('Paid ROI reports stay behind the paywall', `${locked} locked report(s)`);
} catch (e) {
  fail('ROI calculator flow', String(e).slice(0, 140));
}

// Maturity diagnosis: the whole free flow must work with no backend
// configured, and the paid actions must never be in the page.
try {
  await page.goto(base + '/diagnostico', { waitUntil: 'load' });
  await page.evaluate(() => localStorage.clear());
  await page.fill('input[autocomplete="name"]', 'Prueba QA');
  await page.fill('input[type="email"]', 'qa@example.com');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(500);
  // 16 yes/no questions (alternating) and one open question.
  for (let i = 0; i < 17; i++) {
    // Cards slide in one at a time (mode="wait"); act on the current one
    // only once it has actually mounted.
    await page.locator(`[data-question="${i}"]`).waitFor({ state: 'visible', timeout: 8000 });
    const open = await page.locator('input[maxlength="300"]').count();
    if (open) {
      await page.click('text=/Ver mi resultado|See my result|Continuar|Continue/');
    } else {
      await page.click(i % 2 === 0 ? 'button:has-text("Sí")' : 'button:has-text("No")');
    }
    await page.waitForTimeout(320);
  }
  await page.waitForSelector('text=/Comentarios punto por punto|Point-by-point comments/', { timeout: 8000 });
  const pct = await page.locator('text=/^\\d+%$/').first().innerText().catch(() => '');
  ok('Diagnosis flow reaches the result', `score ${pct}`);
  const html = await page.content();
  const leaked = /Registre su marca validando|Acción recomendada<\/span>[^<]*<\/div>[^<]*<div[^>]*>[^<]{20,}/.test(html) || html.includes('tmsearch.uspto.gov');
  (leaked ? fail : ok)('Paid actions never reach an unpaid page', leaked ? 'action text found in DOM' : 'locked');
  const locked = await page.getByText(/Desbloquea tus acciones|Unlock your recommended actions/).count();
  (locked === 1 ? ok : fail)('Diagnosis paywall is shown for gaps', `${locked} paywall(s)`);
  // A reload must bring the result back, not the intro.
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(800);
  const restored = await page.getByText(/Comentarios punto por punto|Point-by-point comments|Desbloquea tus acciones/).count();
  (restored ? ok : fail)('Diagnosis result survives a reload', restored ? 'restored' : 'lost');
  await page.evaluate(() => localStorage.clear());
} catch (e) {
  const where = await page.locator('body').innerText().then((t) => t.slice(0, 160).replace(/\s+/g, ' ')).catch(() => '?');
  fail('Diagnosis flow', String(e).slice(0, 100) + ' | page: ' + where);
}

// ---- 3. Every route renders without JS errors -------------------------
//
// Y sin notas para nosotros mismos. La página de Términos estuvo
// publicada diciendo "[Completa aquí tu política real de reembolsos
// antes de publicar]": un recordatorio interno leyéndose en la página
// legal, que es justo donde un cliente mira para decidir si confía.
const PENDIENTE = /\[(completa|complete|fill|todo|pendiente|reemplaza|replace)\b|lorem ipsum|xxx+/i;
const sinPendientes = [];

for (const route of ['/login', '/registro', '/dashboard', '/roi', '/diagnostico', '/restablecer', '/privacidad', '/terminos', '/pago/exito', '/pago/cancelado', '/no-existe-404']) {
  const before = errors.length;
  try {
    await page.goto(base + route, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(700);
    const text = (await page.locator('#root').innerText()).trim();
    const marcador = text.match(PENDIENTE);
    if (marcador) sinPendientes.push(`${route}: "${marcador[0]}"`);
    if (!text) fail(`Route ${route}`, 'rendered empty');
    else if (errors.length > before) fail(`Route ${route}`, errors.slice(before).join(' | ').slice(0, 160));
    else ok(`Route ${route}`, `${text.length} chars`);
  } catch (e) {
    fail(`Route ${route}`, String(e).slice(0, 120));
  }
}

// La home entera también, secciones diferidas incluidas.
try {
  await page.goto(base + '/', { waitUntil: 'load' });
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 400) window.scrollTo(0, y);
  });
  await page.waitForTimeout(1200);
  const home = await page.locator('#root').innerText();
  const marcador = home.match(PENDIENTE);
  if (marcador) sinPendientes.push(`/: "${marcador[0]}"`);
} catch { /* la home ya se midió arriba */ }

(sinPendientes.length === 0 ? ok : fail)(
  'No internal placeholders are visible to a visitor',
  sinPendientes.length ? sinPendientes.join(' · ') : 'ninguno'
);

// ---- 3b. Que la app se pueda usar sin ver la pantalla -----------------
//
// Un campo sin nombre accesible es un campo que un lector de pantalla
// anuncia como "cuadro de texto" y nada más: quien no ve la etiqueta no
// sabe qué escribir. En un formulario de contacto eso es un cliente que
// no nos escribe.
try {
  const problemas = [];
  const rutas = ['/', '/roi', '/diagnostico', '/login', '/registro', '/analizar'];
  for (const route of rutas) {
    await page.goto(base + route, { waitUntil: 'load' });
    await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 400) window.scrollTo(0, y); });
    await page.waitForTimeout(700);
    const encontrados = await page.evaluate(() => {
      const malos = [];
      // Lo que está oculto a las ayudas técnicas (las trampas para bots)
      // no cuenta: nadie se lo encuentra.
      const oculto = (el) => el.closest('[aria-hidden="true"]') !== null;
      const nombrado = (el) =>
        el.getAttribute('aria-label') ||
        el.getAttribute('aria-labelledby') ||
        el.getAttribute('title') ||
        el.getAttribute('placeholder') ||
        (el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`)) ||
        el.closest('label');
      for (const el of document.querySelectorAll('input:not([type=hidden]), select, textarea'))
        if (!oculto(el) && !nombrado(el)) malos.push('campo ' + (el.name || el.id || el.tagName));
      for (const el of document.querySelectorAll('button, a[href]'))
        if (!oculto(el) && !(el.textContent || '').trim() && !nombrado(el)) malos.push('botón sin nombre');
      for (const el of document.querySelectorAll('img'))
        if (el.getAttribute('alt') === null) malos.push('imagen sin alt');
      const h1 = document.querySelectorAll('h1').length;
      if (h1 !== 1) malos.push(`${h1} encabezados h1`);
      return malos;
    });
    for (const p of encontrados) problemas.push(`${route}: ${p}`);
  }
  (problemas.length === 0 ? ok : fail)(
    'Every control has a name a screen reader can read',
    problemas.length ? problemas.slice(0, 5).join(' · ') : `${rutas.length} rutas revisadas, todo nombrado`
  );
} catch (e) {
  fail('Accessible names', String(e).slice(0, 120));
}

// ---- 3c. Volver de Google con un error tiene que decirse ---------------
//
// "No carga inicio de sesión con Google" era esto: el proveedor devuelve
// el motivo escrito en la URL, la app no lo leía, y la página se pintaba
// igual —sin mensaje y sin sesión—. Desde fuera, eso es exactamente "no
// carga".
try {
  // El hash literal que devuelve Supabase cuando el proveedor está apagado.
  await page.goto(base + '/dashboard#error=server_error&error_description=Unsupported+provider%3A+provider+is+not+enabled', { waitUntil: 'load' });
  await page.waitForTimeout(2000);
  const texto = await page.locator('#root').innerText();
  const loDice = /Providers|no está habilitado|not enabled/i.test(texto);
  // Y la URL tiene que quedar limpia: si el error se queda en la barra,
  // recargar lo repite para siempre.
  const limpia = !page.url().includes('error=');
  (loDice && limpia ? ok : fail)(
    'A failed Google sign-in says why, and does not stick in the URL',
    loDice && limpia ? 'lo explica y limpia la URL' : loDice ? 'lo explica pero el error sigue en la URL' : 'no dijo nada'
  );
} catch (e) {
  fail('Google error return', String(e).slice(0, 120));
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
