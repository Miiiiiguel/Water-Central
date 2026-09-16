// Sicex data access.
//
// Sicex hands each client an Azure Data Lake (ADLS Gen2) directory with a
// read-only SAS token — the same endpoint they document for PowerBI,
// Tableau and Python. That is the supported integration: we list the
// directory and read the files, we do not screen-scrape anything.
//
// One env var carries it all, because that is how Sicex issues it:
//
//   SICEX_SAS_URL=https://<account>.dfs.core.windows.net/<filesystem>/<dir>?<sas>
//
// The SAS is a live credential (read+list, with an expiry). It belongs in
// the hosting environment's secrets, never in the repo.

export interface SicexLocation {
  account: string;
  filesystem: string;
  /** Directory inside the filesystem; '' when the SAS is container-scoped. */
  directory: string;
  /** The SAS query string, without the leading '?'. */
  sas: string;
}

/**
 * Splits the URL Sicex gives you into the pieces the storage APIs need.
 * Accepts the dfs (Data Lake) or blob endpoint, with or without a
 * directory path, and with the SAS either on the URL or passed separately.
 */
export function parseSicexUrl(raw: string, sasOverride?: string): SicexLocation {
  const url = new URL(raw.trim());

  const host = url.hostname; // <account>.dfs.core.windows.net
  const account = host.split('.')[0];
  if (!account || !/\.(dfs|blob)\.core\.windows\.net$/i.test(host)) {
    throw new Error(`Not an Azure storage URL: ${host}`);
  }

  const segments = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
  if (segments.length === 0) throw new Error('URL has no filesystem/container in its path');

  const [filesystem, ...rest] = segments;
  const sas = (sasOverride ?? url.search).replace(/^\?/, '').trim();
  if (!sas) throw new Error('No SAS token: pass it on the URL or as the second argument');

  return { account, filesystem, directory: rest.join('/'), sas };
}

export interface SicexFile {
  /** Path inside the filesystem, e.g. "<dir>/exports/2026-09.csv". */
  name: string;
  bytes: number;
  lastModified: string | null;
  isDirectory: boolean;
}

/** ADLS Gen2 "List Path" endpoint for the directory the SAS points at. */
export function listUrl(loc: SicexLocation, opts: { recursive?: boolean; maxResults?: number; continuation?: string } = {}): string {
  const url = new URL(`https://${loc.account}.dfs.core.windows.net/${encodeURIComponent(loc.filesystem)}`);
  url.search = loc.sas;
  url.searchParams.set('resource', 'filesystem');
  url.searchParams.set('recursive', String(opts.recursive ?? true));
  if (loc.directory) url.searchParams.set('directory', loc.directory);
  if (opts.maxResults) url.searchParams.set('maxResults', String(opts.maxResults));
  if (opts.continuation) url.searchParams.set('continuation', opts.continuation);
  return url.toString();
}

/** Direct read URL for one file returned by the listing. */
export function fileUrl(loc: SicexLocation, name: string): string {
  const path = name.split('/').map(encodeURIComponent).join('/');
  const url = new URL(`https://${loc.account}.dfs.core.windows.net/${encodeURIComponent(loc.filesystem)}/${path}`);
  url.search = loc.sas;
  return url.toString();
}

/** Shapes the JSON the List Path endpoint returns into something usable. */
export function parseListing(payload: unknown): SicexFile[] {
  const paths = (payload as { paths?: unknown[] })?.paths;
  if (!Array.isArray(paths)) return [];
  return paths.map((entry) => {
    const p = entry as Record<string, unknown>;
    return {
      name: String(p.name ?? ''),
      bytes: Number(p.contentLength ?? 0) || 0,
      lastModified: typeof p.lastModified === 'string' ? p.lastModified : null,
      // The API reports directories as the string "true", not a boolean.
      isDirectory: String(p.isDirectory ?? 'false') === 'true',
    };
  });
}

/**
 * True for the zero-byte marker files object storage uses to make an
 * "empty directory" exist (.placeholder, _SUCCESS, .keep …). They are
 * provisioning artefacts, not data — counting them as files makes an
 * empty drop look like a populated one.
 */
export function isPlaceholder(file: { name: string; bytes: number }): boolean {
  if (file.bytes > 0) return false;
  const base = file.name.split('/').pop()?.toLowerCase() ?? '';
  return base === '' || base.startsWith('.') || base === '_success' || base.endsWith('.keep');
}

/** Best guess at how to read a file, from its extension. */
export function formatOf(name: string): 'csv' | 'tsv' | 'json' | 'jsonl' | 'parquet' | 'excel' | 'zip' | 'unknown' {
  const ext = name.toLowerCase().split('.').pop() ?? '';
  if (ext === 'csv') return 'csv';
  if (ext === 'tsv' || ext === 'tab') return 'tsv';
  if (ext === 'json') return 'json';
  if (ext === 'jsonl' || ext === 'ndjson') return 'jsonl';
  if (ext === 'parquet') return 'parquet';
  if (ext === 'xlsx' || ext === 'xls') return 'excel';
  if (ext === 'zip' || ext === 'gz') return 'zip';
  return 'unknown';
}

export function humanBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

/** Lists everything under the SAS directory, following continuations. */
export async function listSicexFiles(loc: SicexLocation, limit = 5000): Promise<SicexFile[]> {
  const files: SicexFile[] = [];
  let continuation: string | undefined;

  do {
    const res = await fetch(listUrl(loc, { recursive: true, maxResults: 500, continuation }));
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`List failed (HTTP ${res.status}). ${body.slice(0, 300)}`);
    }
    files.push(...parseListing(await res.json()));
    continuation = res.headers.get('x-ms-continuation') || undefined;
  } while (continuation && files.length < limit);

  return files;
}

/** Reads the first `bytes` of a file — enough to see its shape. */
export async function peekSicexFile(loc: SicexLocation, name: string, bytes = 64 * 1024): Promise<string> {
  const res = await fetch(fileUrl(loc, name), { headers: { Range: `bytes=0-${bytes - 1}` } });
  if (!res.ok && res.status !== 206) {
    const body = await res.text().catch(() => '');
    throw new Error(`Read failed (HTTP ${res.status}). ${body.slice(0, 300)}`);
  }
  return await res.text();
}
