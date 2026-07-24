// Streaming zip extraction for the USDA FDC single-data-type CSV packages.
// Each package holds its tables under one top-level directory (named after
// the zip); we flatten the needed tables into destDir/<basename>.csv using
// yauzl so the big members (food_nutrient.csv) never fully live in memory.
import { createWriteStream } from 'node:fs';
import { mkdir, rename, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import yauzl from 'yauzl';

async function isNonEmptyFile(filePath: string): Promise<boolean> {
  const st = await stat(filePath).catch(() => null);
  return st?.isFile() === true && st.size > 0;
}

/**
 * Extract `tables` (CSV basenames) from `zipPath` into `destDir`, flattening
 * the package's top-level directory. Already-extracted non-empty files are
 * kept; throws if any requested table is missing from the archive.
 * Returns basename → absolute extracted path.
 */
export async function extractTables(
  zipPath: string,
  destDir: string,
  tables: readonly string[],
): Promise<Map<string, string>> {
  const extracted = new Map<string, string>();
  const pending = new Set<string>();
  for (const table of tables) {
    const destPath = path.join(destDir, table);
    if (await isNonEmptyFile(destPath)) extracted.set(table, destPath);
    else pending.add(table);
  }
  if (pending.size === 0) return extracted;

  await mkdir(destDir, { recursive: true });
  const zipfile = await yauzl.openPromise(zipPath, { lazyEntries: true });
  try {
    for await (const entry of zipfile.eachEntry()) {
      if (entry.fileName.endsWith('/')) continue; // directory entry
      const base = path.posix.basename(entry.fileName);
      if (!pending.has(base)) continue;
      const destPath = path.join(destDir, base);
      const tmpPath = `${destPath}.partial`;
      const stream = await zipfile.openReadStreamPromise(entry);
      try {
        await pipeline(stream, createWriteStream(tmpPath));
      } catch (error) {
        await rm(tmpPath, { force: true });
        throw error;
      }
      await rename(tmpPath, destPath);
      extracted.set(base, destPath);
      pending.delete(base);
      if (pending.size === 0) break; // stop reading entries early
    }
  } finally {
    if (zipfile.isOpen) zipfile.close();
  }

  if (pending.size > 0) {
    throw new Error(
      `Tables missing from ${path.basename(zipPath)}: ${[...pending].join(', ')} — ` +
        `the package layout may have changed; check etl/usda/config.ts`,
    );
  }
  return extracted;
}
