#!/usr/bin/env node
// Pre-production security smoke test. Runs the same checks a first-pass
// pentest would against a live URL, without touching any data:
//
//   pnpm security:smoke https://easycomex.com
//   pnpm security:smoke http://localhost:3000
//
// Exit code 1 if anything fails, so it can gate a deploy in CI.

const base = (process.argv[2] || 'http://localhost:3000').replace(/\/$/, '');
const results = [];

async function check(name, fn) {
  try {
    const detail = await fn();
    results.push({ name, ok: true, detail });
  } catch (err) {
    results.push({ name, ok: false, detail: err.message });
  }
}

const expect = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

const headers = async (path = '/') => (await fetch(base + path, { redirect: 'manual' })).headers;

await check('HTTPS enforced (HSTS)', async () => {
  const h = await headers();
  const v = h.get('strict-transport-security') || '';
  expect(/max-age=\d+/.test(v) && /includeSubDomains/i.test(v), `got "${v}"`);
  return v;
});

await check('Content-Security-Policy present and strict for scripts', async () => {
  const csp = (await headers()).get('content-security-policy') || '';
  expect(csp.includes("default-src 'self'"), 'no default-src self');
  expect(!/script-src[^;]*'unsafe-inline'/.test(csp), "script-src allows 'unsafe-inline'");
  expect(!/script-src[^;]*'unsafe-eval'/.test(csp), "script-src allows 'unsafe-eval'");
  expect(csp.includes("object-src 'none'"), 'object-src not none');
  expect(csp.includes('report-uri'), 'no report-uri');
  return 'strict';
});

await check('Clickjacking / MIME / referrer / permissions headers', async () => {
  const h = await headers();
  expect(h.get('x-frame-options'), 'no X-Frame-Options');
  expect(h.get('x-content-type-options') === 'nosniff', 'no nosniff');
  expect(h.get('referrer-policy'), 'no Referrer-Policy');
  expect((h.get('permissions-policy') || '').includes('camera=()'), 'no Permissions-Policy');
  return 'ok';
});

await check('No server fingerprinting (X-Powered-By)', async () => {
  expect(!(await headers()).get('x-powered-by'), 'X-Powered-By leaked');
  return 'hidden';
});

await check('CORS rejects foreign origins', async () => {
  const r = await fetch(base + '/api/chat', {
    method: 'POST',
    headers: { Origin: 'https://evil.example', 'Content-Type': 'application/json' },
    body: '{}',
  });
  expect(r.status === 403, `status ${r.status}`);
  expect(!r.headers.get('access-control-allow-origin'), 'ACAO header present');
  return '403';
});

await check('Unused HTTP methods rejected', async () => {
  const r = await fetch(base + '/api/chat', { method: 'PUT' });
  expect(r.status === 405, `status ${r.status}`);
  return '405';
});

await check('Unknown /api routes are JSON 404 (no SPA shell)', async () => {
  const r = await fetch(base + '/api/definitely-not-a-route');
  expect(r.status === 404, `status ${r.status}`);
  expect((r.headers.get('content-type') || '').includes('json'), 'not JSON');
  return '404 json';
});

await check('Oversized body rejected', async () => {
  const r = await fetch(base + '/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: [{ role: 'user', content: 'a'.repeat(30000) }] }),
  });
  expect(r.status === 413, `status ${r.status}`);
  return '413';
});

await check('Malformed JSON handled without stack trace', async () => {
  const r = await fetch(base + '/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{bad' });
  const text = await r.text();
  expect(r.status === 400, `status ${r.status}`);
  expect(!/at .*\.js:\d+/.test(text) && !/node_modules/.test(text), 'stack trace in response');
  return '400';
});

await check('Invalid input rejected with generic message', async () => {
  const r = await fetch(base + '/api/create-checkout-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plan: "' OR 1=1 --" }),
  });
  expect([400, 503].includes(r.status), `status ${r.status}`);
  return String(r.status);
});

await check('Health endpoint hides configuration from anonymous callers', async () => {
  const r = await fetch(base + '/api/health');
  const j = await r.json();
  expect(r.status === 200 && j.ok === true, `status ${r.status}`);
  expect(!('integrations' in j), 'integrations exposed without auth');
  return 'ok, minimal';
});

await check('Protected data endpoints require a valid token', async () => {
  const r = await fetch(base + '/api/health', { headers: { Authorization: 'Bearer not-a-real-token' } });
  const j = await r.json();
  expect(!('integrations' in j), 'accepted a bogus token');
  return 'bogus token ignored';
});

await check('Rate limiting active on forms', async () => {
  let limited = false;
  for (let i = 0; i < 12; i++) {
    const r = await fetch(base + '/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'smoke@example.com', website: 'bot' }), // honeypot: nothing is stored
    });
    if (r.status === 429) {
      limited = true;
      break;
    }
  }
  expect(limited, 'no 429 after 12 rapid submissions');
  return '429 reached';
});

await check('security.txt published', async () => {
  const r = await fetch(base + '/.well-known/security.txt');
  expect(r.status === 200 && (await r.text()).includes('Contact:'), `status ${r.status}`);
  return 'present';
});

const pad = (s, n) => (s + ' '.repeat(n)).slice(0, n);
console.log(`\nSecurity smoke test — ${base}\n`);
for (const r of results) console.log(`${r.ok ? '✅' : '❌'} ${pad(r.name, 58)} ${r.detail}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed\n`);
process.exit(failed ? 1 : 0);
