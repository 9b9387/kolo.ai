// Runtime Open Food Facts barcode fallback client. Phase 1 does no bulk OFF
// import — on a local barcode miss the MCP layer calls fetchOffProduct once
// and caches the normalized hit (see src/lib/repos/food.ts#cacheOffFood).
//
// Etiquette: a process-wide token bucket caps outbound calls at 10/min. When
// the bucket is empty the call returns null immediately (no queueing) — the
// agent simply sees an empty search result and can retry later.

import { normalizeOffProduct } from '../../etl/off/normalize';
import type { NormalizedFood } from '../../etl/lib/batch';

const OFF_PRODUCT_URL = 'https://world.openfoodfacts.org/api/v2/product/';
const USER_AGENT = 'Kolo/0.1 (github.com/9b9387/kolo.ai)';
const TIMEOUT_MS = 5000;
const RATE_LIMIT = 10; // requests…
const RATE_WINDOW_MS = 60_000; // …per minute

// Only the fields normalizeOffProduct consumes — the full product document is
// two orders of magnitude larger.
const FIELDS = [
  'code',
  'product_name',
  'product_name_en',
  'product_name_zh',
  'brands',
  'categories_tags',
  'serving_size',
  'serving_quantity',
  'serving_quantity_unit',
  'nutriments',
].join(',');

interface TokenBucket {
  tokens: number;
  lastRefillMs: number;
}

// Survives Next.js dev hot reloads the same way src/lib/db.ts keeps its
// PrismaClient: one bucket per process on globalThis.
const globalForOff = globalThis as unknown as { __koloOffBucket?: TokenBucket };

function takeToken(): boolean {
  const now = Date.now();
  const bucket = (globalForOff.__koloOffBucket ??= { tokens: RATE_LIMIT, lastRefillMs: now });
  const elapsed = Math.max(0, now - bucket.lastRefillMs);
  bucket.tokens = Math.min(RATE_LIMIT, bucket.tokens + (elapsed * RATE_LIMIT) / RATE_WINDOW_MS);
  bucket.lastRefillMs = now;
  if (bucket.tokens < 1) return false;
  bucket.tokens -= 1;
  return true;
}

/**
 * Fetch one product by barcode from the OFF v2 API and normalize it.
 * Returns null on: rate limit exhausted, network error/timeout, non-200,
 * unknown barcode, or a product that fails core-value validation.
 */
export async function fetchOffProduct(barcode: string): Promise<NormalizedFood | null> {
  if (!takeToken()) return null;

  let body: unknown;
  try {
    const res = await fetch(
      `${OFF_PRODUCT_URL}${encodeURIComponent(barcode)}?fields=${encodeURIComponent(FIELDS)}`,
      {
        headers: { 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: 'no-store',
      },
    );
    if (res.status !== 200) return null;
    body = await res.json();
  } catch {
    // Timeout, DNS failure, malformed JSON — the fallback is best-effort.
    return null;
  }

  if (body === null || typeof body !== 'object') return null;
  const product = (body as { product?: unknown }).product;
  if (product === undefined || product === null) return null;
  return normalizeOffProduct(product, barcode);
}
