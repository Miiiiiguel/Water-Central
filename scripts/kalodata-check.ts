/**
 * pnpm kalodata:check — ¿la llave de Kalodata funciona, y con qué forma?
 *
 * Kalodata no publica documentación: la llave y el endpoint los entrega
 * su equipo comercial. Este script prueba la combinación que tengas
 * configurada y, si no sabes cuál es, prueba las formas de autenticación
 * habituales contra la URL que le pases, y te dice exactamente cuál
 * responde. Nada se inventa: imprime el status y el principio de la
 * respuesta real.
 *
 *   KALODATA_API_URL="https://..." pnpm kalodata:check
 *   pnpm kalodata:check "https://.../product/rank" "zapatos"
 */

import { readFileSync } from 'node:fs';

// Lee .env sin dependencias (igual que sicex:explore, que no las tiene).
// Las variables ya presentes en el entorno mandan.
try {
  for (const raw of readFileSync('.env', 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    if (!process.env[key]) process.env[key] = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
  }
} catch {
  /* sin .env: se usan las variables del entorno */
}

const KEY = process.env.KALODATA_API_KEY;
// Base real de la Open API de Kalodata. El patrón es
//   https://www.kalodata.com/openapi/v1/tiktok/{módulo}/{acción}
// con módulos category | shop | creator | product | video | livestream
// y acciones rank | detail.
const DEFAULT_URL = 'https://www.kalodata.com/openapi/v1/tiktok/product/rank';
const URL_ARG = process.argv[2] || process.env.KALODATA_API_URL || DEFAULT_URL;
const QUERY = process.argv[3] || 'jeans';

function line(s = '') {
  console.log(s);
}

if (!KEY) {
  line('✗ Falta KALODATA_API_KEY en .env.');
  process.exit(1);
}
line(`Llave: ${KEY.slice(0, 8)}…${KEY.slice(-4)} (${KEY.length} caracteres)`);

type Attempt = { label: string; header: string };

// El soporte de Kalodata confirmó: POST + JSON, llave en un encabezado,
// campos comunes region / language / currency / date_range. Lo único que
// falta confirmar es el NOMBRE del encabezado — `secret-key` es el que
// nombran, y los demás quedan como red de seguridad.
const HEADERS = ['secret-key', 'X-Secret-Key', 'secretKey', 'Authorization', 'x-api-key', 'accessKey'];

function bodyFor() {
  const end = new Date();
  const start = new Date();
  start.setUTCDate(start.getUTCDate() - 30);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return {
    region: 'US',
    language: 'en',
    currency: 'USD',
    date_range: { start_date: iso(start), end_date: iso(end) },
    keyword: QUERY,
    page: 1,
    page_size: 5,
  };
}

// Un proxy corporativo o de sandbox contesta 403 sin que la petición
// llegue a Kalodata. Distinguirlo importa: no es un problema de la llave.
let blockedByProxy = false;

async function probe(a: Attempt): Promise<Attempt | null> {
  const value = a.header === 'Authorization' ? `Bearer ${KEY}` : KEY!;
  try {
    const res = await fetch(URL_ARG, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', [a.header]: value },
      body: JSON.stringify(bodyFor()),
      signal: AbortSignal.timeout(15000),
    });
    const text = (await res.text()).slice(0, 300).replace(/\s+/g, ' ');
    if (/not in allowlist|egress|proxy/i.test(text)) blockedByProxy = true;
    const mark = res.ok ? '✓' : res.status === 401 || res.status === 403 ? '·' : '?';
    line(`  ${mark} ${a.label.padEnd(18)} ${res.status}  ${text.slice(0, 120)}`);
    return res.ok ? a : null;
  } catch (err) {
    line(`  ✗ ${a.label.padEnd(18)} ${String(err).slice(0, 100)}`);
    return null;
  }
}

line(`Endpoint: ${URL_ARG}`);
line(`Consulta de prueba: "${QUERY}"`);
line('');

if (process.env.KALODATA_AUTH_NAME) line(`(KALODATA_AUTH_NAME=${process.env.KALODATA_AUTH_NAME})`);
line('Probando nombres de encabezado (POST + JSON):');

// Paramos en cuanto una funcione: una llamada que pasa GASTA CRÉDITOS
// (1 crédito ~ 0.1 USD). Un 401/403 no cuesta nada, así que probar las
// formas equivocadas es gratis — acertar es lo que se cobra, y con una
// vez basta.
let winner: Attempt | null = null;
for (const header of HEADERS) {
  winner = await probe({ label: header, header });
  if (winner) break;
}

line('');
if (winner) {
  line(`✓ Funciona con el encabezado: ${winner.label}`);
  line('');
  line('  Pon esto en tu .env:');
  line(`    KALODATA_API_KEY=<tu llave>`);
  if (winner.label !== 'secret-key') line(`    KALODATA_AUTH_NAME=${winner.label}`);
  else line('    (no hace falta KALODATA_AUTH_NAME: `secret-key` es el valor por defecto)');
  line('');
  line('  Arriba está la respuesta real: mándamela y termino de mapear');
  line('  los campos a lo que muestra Marco Polo.');
} else {
  line('✗ Ninguna forma respondió 200.');
  line('');
  if (blockedByProxy) {
    line('  Pero eso NO es Kalodata: el 403 lo puso un proxy de red que no');
    line('  tiene kalodata.com en su lista de dominios permitidos. Corre');
    line('  este script desde tu máquina y vuelve a mirar.');
  } else {
    line('  401/403 en todas: la llave no está habilitada para ese endpoint,');
    line('  o el nombre del header es otro (búscalo en la pestaña API del');
    line('  Centro Abierto). 404: la ruta no es esa — el patrón es');
    line('  /openapi/v1/tiktok/{módulo}/{acción}, con módulos category,');
    line('  shop, creator, product, video y livestream.');
    line('');
    line('  La respuesta de arriba es literal: mándasela al chat de soporte');
    line('  de Kalodata y te dicen cuál corresponde.');
  }
}
