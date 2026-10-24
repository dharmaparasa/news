import { dbClear, dbGetAll, dbPutMany, STORE_NAMES, type StoreName } from './db';

/** Everything except the API key is exported. */
export async function exportAll(): Promise<string> {
  const data: Record<string, unknown> = { app: 'exam-current-affairs', version: 1, exportedAt: new Date().toISOString() };
  for (const s of STORE_NAMES) data[s] = await dbGetAll(s);
  return JSON.stringify(data);
}

export async function importAll(json: string): Promise<number> {
  const d = JSON.parse(json);
  if (d?.app !== 'exam-current-affairs') throw new Error('This file is not a backup from this app.');
  let n = 0;
  for (const s of STORE_NAMES) {
    const rows = d[s];
    if (!Array.isArray(rows)) continue;
    await dbPutMany(s as StoreName, rows as never[]);
    n += rows.length;
  }
  return n;
}

export async function wipeAll() {
  for (const s of STORE_NAMES) await dbClear(s);
}
