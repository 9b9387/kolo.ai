// Streaming dataset download with sha256 verification and resume-by-skip:
// an existing non-empty destination is trusted (its checksum is recomputed
// and verified when expectedSha256 is given). Callers implement --redownload
// by passing force: true.
import { createHash } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, rename, rm, stat } from 'node:fs/promises';
import { dirname } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

export interface DownloadResult {
  path: string;
  sha256: string;
  bytes: number;
  /** true when an existing valid file was reused instead of downloading. */
  skipped: boolean;
}

async function sha256OfFile(filePath: string): Promise<{ sha256: string; bytes: number }> {
  const hash = createHash('sha256');
  let bytes = 0;
  for await (const chunk of createReadStream(filePath)) {
    const buf = chunk as Buffer;
    hash.update(buf);
    bytes += buf.length;
  }
  return { sha256: hash.digest('hex'), bytes };
}

export async function downloadFile(
  url: string,
  destPath: string,
  opts: { expectedSha256?: string; force?: boolean } = {},
): Promise<DownloadResult> {
  const expected = opts.expectedSha256?.toLowerCase();

  if (!opts.force) {
    const st = await stat(destPath).catch(() => null);
    if (st?.isFile() && st.size > 0) {
      const { sha256, bytes } = await sha256OfFile(destPath);
      // A checksum mismatch means the existing file is corrupt/stale —
      // fall through and download again instead of failing.
      if (!expected || sha256 === expected) {
        return { path: destPath, sha256, bytes, skipped: true };
      }
    }
  }

  await mkdir(dirname(destPath), { recursive: true });
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok || !response.body) {
    throw new Error(`Download failed: HTTP ${response.status} ${response.statusText} for ${url}`);
  }

  const tmpPath = `${destPath}.partial`;
  const hash = createHash('sha256');
  let bytes = 0;
  const source = Readable.fromWeb(
    response.body as unknown as import('node:stream/web').ReadableStream<Uint8Array>,
  );
  try {
    await pipeline(
      source,
      async function* (chunks: AsyncIterable<Buffer | Uint8Array>) {
        for await (const chunk of chunks) {
          const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          hash.update(buf);
          bytes += buf.length;
          yield buf;
        }
      },
      createWriteStream(tmpPath),
    );
  } catch (error) {
    await rm(tmpPath, { force: true });
    throw error;
  }

  const sha256 = hash.digest('hex');
  if (expected && sha256 !== expected) {
    await rm(tmpPath, { force: true });
    throw new Error(
      `sha256 mismatch for ${url}: expected ${expected}, got ${sha256} (${bytes} bytes)`,
    );
  }
  await rename(tmpPath, destPath);
  return { path: destPath, sha256, bytes, skipped: false };
}
