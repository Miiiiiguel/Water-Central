import { describe, expect, it } from 'vitest';
import { fileUrl, formatOf, humanBytes, isPlaceholder, listUrl, parseListing, parseSicexUrl } from './sicexStorage';

// The SAS below is fake — these tests only exercise URL shaping and parsing.
const SAS = 'sv=2025-11-05&sr=d&sp=rl&sig=FAKESIGNATURE%3D';
const URL_WITH_SAS = `https://acct.dfs.core.windows.net/reportes/abc-123?${SAS}`;

describe('parseSicexUrl', () => {
  it('splits account, filesystem, directory and SAS from one URL', () => {
    const loc = parseSicexUrl(URL_WITH_SAS);
    expect(loc).toEqual({ account: 'acct', filesystem: 'reportes', directory: 'abc-123', sas: SAS });
  });

  it('accepts the SAS passed separately', () => {
    const loc = parseSicexUrl('https://acct.dfs.core.windows.net/reportes/abc-123', SAS);
    expect(loc.sas).toBe(SAS);
    expect(loc.directory).toBe('abc-123');
  });

  it('handles a container-scoped URL with no directory', () => {
    expect(parseSicexUrl(`https://acct.dfs.core.windows.net/reportes?${SAS}`).directory).toBe('');
  });

  it('keeps nested directories intact', () => {
    expect(parseSicexUrl(`https://acct.dfs.core.windows.net/fs/a/b/c?${SAS}`).directory).toBe('a/b/c');
  });

  it('accepts the blob endpoint too', () => {
    expect(parseSicexUrl(`https://acct.blob.core.windows.net/fs/d?${SAS}`).account).toBe('acct');
  });

  it('refuses a non-Azure host and a missing SAS', () => {
    expect(() => parseSicexUrl(`https://example.com/fs/d?${SAS}`)).toThrow(/Azure/);
    expect(() => parseSicexUrl('https://acct.dfs.core.windows.net/fs/d')).toThrow(/SAS/);
  });
});

describe('listUrl', () => {
  const loc = parseSicexUrl(URL_WITH_SAS);

  it('targets List Path on the filesystem, scoped to the directory', () => {
    const url = new URL(listUrl(loc));
    expect(url.pathname).toBe('/reportes');
    expect(url.searchParams.get('resource')).toBe('filesystem');
    expect(url.searchParams.get('directory')).toBe('abc-123');
    expect(url.searchParams.get('recursive')).toBe('true');
  });

  it('keeps the SAS signature intact alongside the added params', () => {
    const url = new URL(listUrl(loc));
    expect(url.searchParams.get('sig')).toBe('FAKESIGNATURE=');
    expect(url.searchParams.get('sp')).toBe('rl');
  });

  it('passes a continuation token through', () => {
    expect(new URL(listUrl(loc, { continuation: 'tok' })).searchParams.get('continuation')).toBe('tok');
  });
});

describe('fileUrl', () => {
  it('encodes each path segment but keeps the separators', () => {
    const url = new URL(fileUrl(parseSicexUrl(URL_WITH_SAS), 'abc-123/sub dir/file name.csv'));
    expect(url.pathname).toBe('/reportes/abc-123/sub%20dir/file%20name.csv');
  });
});

describe('parseListing', () => {
  it('reads the API shape, including its stringly-typed fields', () => {
    const files = parseListing({
      paths: [
        { name: 'dir/a.csv', contentLength: '2048', lastModified: 'Mon, 01 Sep 2026 10:00:00 GMT' },
        { name: 'dir/sub', isDirectory: 'true' },
      ],
    });
    expect(files[0]).toEqual({ name: 'dir/a.csv', bytes: 2048, lastModified: 'Mon, 01 Sep 2026 10:00:00 GMT', isDirectory: false });
    expect(files[1].isDirectory).toBe(true);
    expect(files[1].bytes).toBe(0);
  });

  it('returns nothing for an empty or unexpected payload', () => {
    expect(parseListing({})).toEqual([]);
    expect(parseListing(null)).toEqual([]);
  });
});

describe('formatOf', () => {
  it('maps the extensions we know how to read', () => {
    expect(formatOf('x/y.CSV')).toBe('csv');
    expect(formatOf('a.parquet')).toBe('parquet');
    expect(formatOf('a.xlsx')).toBe('excel');
    expect(formatOf('a.ndjson')).toBe('jsonl');
    expect(formatOf('README')).toBe('unknown');
  });
});

describe('humanBytes', () => {
  it('scales the unit', () => {
    expect(humanBytes(512)).toBe('512 B');
    expect(humanBytes(2048)).toBe('2.0 KB');
    expect(humanBytes(5 * 1024 * 1024)).toBe('5.0 MB');
  });
});

describe('isPlaceholder', () => {
  it('recognises the zero-byte markers that fake an empty directory', () => {
    // Exactly what the Sicex drop returned before any data was published.
    expect(isPlaceholder({ name: 'e658138d/.placeholder', bytes: 0 })).toBe(true);
    expect(isPlaceholder({ name: 'dir/_SUCCESS', bytes: 0 })).toBe(true);
    expect(isPlaceholder({ name: 'dir/.keep', bytes: 0 })).toBe(true);
  });

  it('never hides a file that actually has bytes', () => {
    expect(isPlaceholder({ name: 'dir/.placeholder', bytes: 12 })).toBe(false);
    expect(isPlaceholder({ name: 'dir/enero.csv', bytes: 0 })).toBe(false);
    expect(isPlaceholder({ name: 'dir/enero.csv', bytes: 9000 })).toBe(false);
  });
});
