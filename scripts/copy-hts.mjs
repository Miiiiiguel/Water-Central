#!/usr/bin/env node
// El arancel es un archivo de datos, no código: esbuild no lo ve.
// Sin esta copia el servidor compilado arranca bien y explota la
// primera vez que alguien clasifica un producto, en producción.
import { copyFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const desde = 'server/hts';
const hasta = 'dist';
mkdirSync(hasta, { recursive: true });

let copiados = 0;
for (const archivo of ['hts.ndjson.gz', 'hts.meta.json']) {
  const origen = join(desde, archivo);
  if (!existsSync(origen)) {
    console.error(`Falta ${origen}. Corré: node scripts/hts-ingest.mjs <htsdata.csv>`);
    process.exit(1);
  }
  copyFileSync(origen, join(hasta, archivo));
  copiados++;
}
// Los aranceles de los otros países (server/aranceles/arancel-*).
for (const archivo of readdirSync('server/aranceles').filter((f) => /^arancel-.+\.(ndjson\.gz|meta\.json)$/.test(f))) {
  copyFileSync(join('server/aranceles', archivo), join(hasta, archivo));
  copiados++;
}
console.log(`arancel: ${copiados} archivos copiados a ${hasta}/`);
