#!/usr/bin/env node
// Carga el arancel de Estados Unidos (HTS) al repositorio.
//
//   node scripts/hts-ingest.mjs <archivo.csv> [--out server/hts/hts.ndjson.gz]
//
// La fuente es el export oficial de la USITC (hts.usitc.gov -> Export ->
// CSV; si lo bajaste en Excel, guardalo como CSV primero). Este script
// NO interpreta ni corrige nada: copia las nueve columnas tal como
// vienen, una fila por línea. Lo derivado —el padre de cada partida, la
// descripción completa, qué arancel manda— se calcula al leer el
// archivo (server/hts/store.ts), nunca se escribe encima del original.
//
// Se guarda comprimido porque son ~35.000 filas: 3,4 MB de texto que
// quedan en menos de 1 MB, y Node lo descomprime al arrancar en unos
// pocos cientos de milisegundos.

import { createReadStream, writeFileSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { mkdirSync } from 'node:fs';

/** Las columnas del export oficial, en su orden, con el nombre corto que usamos. */
const COLUMNAS = [
  ['HTS Number', 'htsno'],
  ['Indent', 'indent'],
  ['Description', 'description'],
  ['Unit of Quantity', 'units'],
  ['General Rate of Duty', 'general'],
  ['Special Rate of Duty', 'special'],
  ['Column 2 Rate of Duty', 'other'],
  ['Quota Quantity', 'quota'],
  ['Additional Duties', 'additional'],
];

/**
 * Lector de CSV con comillas. No se usa una librería para no sumar una
 * dependencia por un script que corre una vez al año, cuando la USITC
 * publica la revisión nueva.
 */
function* filasDeCsv(texto) {
  let campo = '';
  let fila = [];
  let enComillas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (enComillas) {
      if (c === '"') {
        if (texto[i + 1] === '"') { campo += '"'; i++; }
        else enComillas = false;
      } else campo += c;
      continue;
    }
    if (c === '"') { enComillas = true; continue; }
    if (c === ',') { fila.push(campo); campo = ''; continue; }
    if (c === '\r') continue;
    if (c === '\n') { fila.push(campo); yield fila; fila = []; campo = ''; continue; }
    campo += c;
  }
  if (campo !== '' || fila.length) { fila.push(campo); yield fila; }
}

async function leerTodo(ruta) {
  const trozos = [];
  for await (const t of createReadStream(ruta, 'utf8')) trozos.push(t);
  return trozos.join('');
}

const args = process.argv.slice(2);
const entrada = args.find((a) => !a.startsWith('--'));
const salida = (args.find((a) => a.startsWith('--out=')) || '--out=server/hts/hts.ndjson.gz').slice(6);

if (!entrada) {
  console.error('Falta el CSV. Uso: node scripts/hts-ingest.mjs htsdata.csv');
  process.exit(1);
}

const texto = await leerTodo(resolve(entrada));
const filas = [...filasDeCsv(texto)];
const encabezado = filas.shift();

// Si las columnas cambian de nombre o de orden, se para: más vale no
// cargar nada que cargar un arancel en la columna equivocada.
const esperado = COLUMNAS.map(([oficial]) => oficial);
const recibido = encabezado.map((c) => c.trim());
if (recibido.length !== esperado.length || esperado.some((c, i) => c !== recibido[i])) {
  console.error('El encabezado no es el del export oficial de la USITC.');
  console.error('  esperado:', esperado.join(' | '));
  console.error('  recibido:', recibido.join(' | '));
  process.exit(1);
}

const lineas = [];
let conCodigo = 0;
for (const fila of filas) {
  if (fila.every((c) => c.trim() === '')) continue;
  const registro = {};
  COLUMNAS.forEach(([, clave], i) => { registro[clave] = (fila[i] ?? '').trim(); });
  if (registro.htsno) conCodigo++;
  lineas.push(JSON.stringify(registro));
}

const cuerpo = lineas.join('\n') + '\n';
const comprimido = gzipSync(Buffer.from(cuerpo, 'utf8'), { level: 9 });
mkdirSync(dirname(resolve(salida)), { recursive: true });
writeFileSync(resolve(salida), comprimido);

const meta = {
  fuente: 'USITC Harmonized Tariff Schedule (export oficial)',
  archivo: entrada.split('/').pop(),
  filas: lineas.length,
  conNumeroHts: conCodigo,
  sha256DelCsv: createHash('sha256').update(texto).digest('hex'),
  cargadoEl: new Date().toISOString().slice(0, 10),
};
writeFileSync(resolve(salida).replace(/\.ndjson\.gz$/, '.meta.json'), JSON.stringify(meta, null, 2) + '\n');

console.log(`${lineas.length} filas (${conCodigo} con número HTS)`);
console.log(`${salida} — ${(statSync(resolve(salida)).size / 1024).toFixed(0)} KB comprimido`);
