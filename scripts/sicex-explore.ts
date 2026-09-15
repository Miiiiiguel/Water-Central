#!/usr/bin/env tsx
/**
 * Look inside the Sicex data directory and report what is actually there.
 *
 *   SICEX_SAS_URL="https://...dfs.core.windows.net/fs/dir?sv=..." pnpm sicex:explore
 *   pnpm sicex:explore "<url>" "<sas>"          # or pass them as arguments
 *
 * Run it from somewhere with network access to *.dfs.core.windows.net.
 * It only lists and reads — `sp=rl` is all it needs, and it writes nothing
 * back. Paste the output here and the importer gets built around the real
 * file shapes instead of assumptions.
 */
import {
  formatOf, humanBytes, isPlaceholder, listSicexFiles, parseSicexUrl, peekSicexFile, type SicexFile,
} from '../server/sicexStorage';

const raw = process.argv[2] || process.env.SICEX_SAS_URL;
const sas = process.argv[3] || process.env.SICEX_SAS;

if (!raw) {
  console.error(`
Falta la URL de Sicex.

  SICEX_SAS_URL="https://<cuenta>.dfs.core.windows.net/<fs>/<carpeta>?<sas>" pnpm sicex:explore

o bien:

  pnpm sicex:explore "https://<cuenta>.dfs.core.windows.net/<fs>/<carpeta>" "sv=...&sig=..."
`);
  process.exit(1);
}

const loc = parseSicexUrl(raw, sas);
console.log(`\nCuenta:      ${loc.account}`);
console.log(`Filesystem:  ${loc.filesystem}`);
console.log(`Carpeta:     ${loc.directory || '(raíz)'}`);

// The SAS carries its own expiry; surfacing it avoids a confusing 403 later.
const expiry = new URLSearchParams(loc.sas).get('se');
const perms = new URLSearchParams(loc.sas).get('sp');
console.log(`Permisos:    ${perms ?? '?'}${expiry ? `  ·  vence ${expiry}` : ''}\n`);

let files: SicexFile[];
try {
  files = await listSicexFiles(loc);
} catch (err) {
  console.error(`No se pudo listar: ${(err as Error).message}\n`);
  console.error('Causas típicas: el SAS venció, no incluye permiso de listado (necesita "l"),');
  console.error('o esta máquina no tiene salida a *.dfs.core.windows.net.\n');
  process.exit(2);
}

const dirs = files.filter((f) => f.isDirectory);
const allFiles = files.filter((f) => !f.isDirectory);
const markers = allFiles.filter(isPlaceholder);
const real = allFiles.filter((f) => !isPlaceholder(f));

if (real.length === 0) {
  if (markers.length > 0) {
    console.log('La carpeta existe y la credencial funciona, pero TODAVÍA NO HAY DATOS.');
    console.log(`Solo está el marcador de carpeta vacía: ${markers.map((m) => m.name.split('/').pop()).join(', ')}\n`);
    for (const m of markers) console.log(`  creado/modificado: ${m.lastModified}`);
    console.log('\nSicex aprovisionó el espacio pero no ha publicado ningún archivo.');
    console.log('Hay que pedirles que empiecen a dejar los datos.\n');
  } else {
    console.log('La carpeta está vacía (o el SAS no alcanza a ver su contenido).\n');
  }
  process.exit(0);
}

const totalBytes = real.reduce((a, f) => a + f.bytes, 0);
console.log(`${real.length} archivo(s) · ${dirs.length} subcarpeta(s) · ${humanBytes(totalBytes)} en total\n`);

// What kinds of files are we dealing with?
const byFormat = new Map<string, { count: number; bytes: number }>();
for (const f of real) {
  const key = formatOf(f.name);
  const acc = byFormat.get(key) ?? { count: 0, bytes: 0 };
  byFormat.set(key, { count: acc.count + 1, bytes: acc.bytes + f.bytes });
}
console.log('Formatos:');
for (const [fmt, acc] of [...byFormat].sort((a, b) => b[1].count - a[1].count)) {
  console.log(`  ${fmt.padEnd(9)} ${String(acc.count).padStart(5)} archivo(s)  ${humanBytes(acc.bytes)}`);
}

console.log('\nMás recientes:');
const recent = [...real].sort((a, b) => String(b.lastModified).localeCompare(String(a.lastModified))).slice(0, 25);
for (const f of recent) {
  console.log(`  ${(f.lastModified ?? '').slice(0, 19).padEnd(20)} ${humanBytes(f.bytes).padStart(10)}  ${f.name}`);
}
if (real.length > recent.length) console.log(`  … y ${real.length - recent.length} más`);

// Preview the largest readable file — that is where the real columns are.
const previewable = real.filter((f) => ['csv', 'tsv', 'json', 'jsonl'].includes(formatOf(f.name)));
const sample = previewable.sort((a, b) => b.bytes - a.bytes)[0];

if (!sample) {
  console.log('\nNingún archivo de texto para previsualizar.');
  const binary = real.find((f) => ['parquet', 'excel', 'zip'].includes(formatOf(f.name)));
  if (binary) {
    console.log(`Hay archivos tipo "${formatOf(binary.name)}" (ej. ${binary.name}).`);
    console.log('Se pueden leer, pero necesitan una librería extra — avisá y la agrego.');
  }
  process.exit(0);
}

console.log(`\n--- Muestra de: ${sample.name} (${humanBytes(sample.bytes)}) ---`);
try {
  const text = await peekSicexFile(loc, sample.name, 8 * 1024);
  const lines = text.split(/\r?\n/).slice(0, 12);
  for (const line of lines) console.log(line.length > 400 ? line.slice(0, 400) + ' …' : line);
  console.log('--- fin de la muestra ---\n');
} catch (err) {
  console.error(`No se pudo leer el archivo: ${(err as Error).message}\n`);
}
