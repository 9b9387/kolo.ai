// Food library data access. Visibility rule for queries: status = 'active'
// AND (public row OR owned by the requesting user). getFood additionally
// allows retired foods because diet logs may still reference them.

import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/db';
import { Prisma } from '@/generated/prisma/client';
import { buildSearchText } from '@/lib/search-text';
// ETL-shared pure modules (relative paths — etl/ is outside the @/ alias).
import type { NormalizedFood } from '../../../etl/lib/batch';
import { contentHash } from '../../../etl/lib/hash';
import {
  COMPLETENESS_COLUMNS,
  NUTRIENT_COLUMNS,
  type NutrientColumn,
} from '../../../etl/lib/nutrients';

export interface FoodSearchRow {
  id: bigint;
  name: string;
  nameZh: string | null;
  nameEn: string | null;
  brand: string | null;
  barcode: string | null;
  dataType: string;
  verified: boolean;
  sourceCode: string;
  energyKcal: Prisma.Decimal | null;
  proteinG: Prisma.Decimal | null;
  carbG: Prisma.Decimal | null;
  fatG: Prisma.Decimal | null;
  hasPortions: boolean;
}

export interface SearchFoodsResult {
  rows: FoodSearchRow[];
  hasMore: boolean;
}

export interface SearchFoodsParams {
  query?: string;
  barcode?: string;
  sourceCode?: string;
  dataType?: string;
  limit: number;
  offset: number;
}

// Raw shape of the FULLTEXT query below; boolean-ish columns come back as
// TINYINT/BIGINT from MySQL, normalized in the mapper.
interface RawSearchRow {
  id: bigint;
  name: string;
  nameZh: string | null;
  nameEn: string | null;
  brand: string | null;
  barcode: string | null;
  dataType: string;
  verified: number | boolean;
  sourceCode: string;
  energyKcal: Prisma.Decimal | null;
  proteinG: Prisma.Decimal | null;
  carbG: Prisma.Decimal | null;
  fatG: Prisma.Decimal | null;
  hasPortions: number | bigint | boolean;
}

// BOOLEAN MODE operators and quoting characters; user keywords must never
// reach the parser as syntax.
const BOOLEAN_MODE_META = /[+\-@><()~*"'\\]/g;

export async function searchFoods(
  userId: string,
  params: SearchFoodsParams,
): Promise<SearchFoodsResult> {
  const { query, barcode, sourceCode, dataType, limit, offset } = params;
  const trimmed = query?.trim() ?? '';

  if (!barcode) {
    if (trimmed.length >= 2) {
      return searchFoodsFulltext(userId, trimmed, sourceCode, dataType, limit, offset);
    }
    // Too short for the ngram FULLTEXT index (or missing entirely).
    if (trimmed.length === 0) return { rows: [], hasMore: false };
  }

  const foods = await prisma.food.findMany({
    where: {
      status: 'active',
      OR: [{ createdByUserId: null }, { createdByUserId: userId }],
      ...(sourceCode ? { source: { code: sourceCode } } : {}),
      ...(dataType ? { dataType } : {}),
      // Exact barcode match (column is non-unique: OFF has duplicate codes),
      // otherwise single-character prefix fallback.
      ...(barcode ? { barcode } : { name: { startsWith: trimmed } }),
    },
    select: {
      id: true,
      name: true,
      nameZh: true,
      nameEn: true,
      brand: true,
      barcode: true,
      dataType: true,
      verified: true,
      source: { select: { code: true } },
      nutrients: { select: { energyKcal: true, proteinG: true, carbG: true, fatG: true } },
      _count: { select: { portions: true } },
    },
    orderBy: { id: 'asc' },
    skip: offset,
    take: limit + 1,
  });

  const hasMore = foods.length > limit;
  const rows: FoodSearchRow[] = foods.slice(0, limit).map((f) => ({
    id: f.id,
    name: f.name,
    nameZh: f.nameZh,
    nameEn: f.nameEn,
    brand: f.brand,
    barcode: f.barcode,
    dataType: f.dataType,
    verified: f.verified,
    sourceCode: f.source.code,
    energyKcal: f.nutrients?.energyKcal ?? null,
    proteinG: f.nutrients?.proteinG ?? null,
    carbG: f.nutrients?.carbG ?? null,
    fatG: f.nutrients?.fatG ?? null,
    hasPortions: f._count.portions > 0,
  }));
  return { rows, hasMore };
}

async function searchFoodsFulltext(
  userId: string,
  query: string,
  sourceCode: string | undefined,
  dataType: string | undefined,
  limit: number,
  offset: number,
): Promise<SearchFoodsResult> {
  const cleaned = query.replace(BOOLEAN_MODE_META, ' ').replace(/\s+/g, ' ').trim();
  if (cleaned.length === 0) return { rows: [], hasMore: false };

  const sourceFilter = sourceCode ? Prisma.sql`AND s.code = ${sourceCode}` : Prisma.empty;
  const dataTypeFilter = dataType ? Prisma.sql`AND f.dataType = ${dataType}` : Prisma.empty;

  // Table names are the @@map'd ones; columns keep Prisma's camelCase.
  const raw = await prisma.$queryRaw<RawSearchRow[]>(Prisma.sql`
    SELECT
      f.id, f.name, f.nameZh, f.nameEn, f.brand, f.barcode, f.dataType, f.verified,
      s.code AS sourceCode,
      n.energyKcal, n.proteinG, n.carbG, n.fatG,
      EXISTS(SELECT 1 FROM food_portion p WHERE p.foodId = f.id) AS hasPortions
    FROM food f
    JOIN data_source s ON s.id = f.sourceId
    LEFT JOIN food_nutrients n ON n.foodId = f.id
    WHERE MATCH(f.searchText) AGAINST(${cleaned} IN BOOLEAN MODE)
      AND f.status = 'active'
      AND (f.createdByUserId IS NULL OR f.createdByUserId = ${userId})
      ${sourceFilter}
      ${dataTypeFilter}
    ORDER BY MATCH(f.searchText) AGAINST(${cleaned} IN BOOLEAN MODE) DESC, f.id ASC
    LIMIT ${limit + 1} OFFSET ${offset}
  `);

  const hasMore = raw.length > limit;
  const rows: FoodSearchRow[] = raw.slice(0, limit).map((r) => ({
    id: BigInt(r.id),
    name: r.name,
    nameZh: r.nameZh,
    nameEn: r.nameEn,
    brand: r.brand,
    barcode: r.barcode,
    dataType: r.dataType,
    verified: Boolean(r.verified),
    sourceCode: r.sourceCode,
    energyKcal: r.energyKcal,
    proteinG: r.proteinG,
    carbG: r.carbG,
    fatG: r.fatG,
    hasPortions: Boolean(r.hasPortions),
  }));
  return { rows, hasMore };
}

const OFF_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * A cached OFF row for this barcode fresher than 30 days, or null. Used by
 * search_foods to confirm a barcode miss before calling the OFF API — a fresh
 * row means the earlier local miss was final (e.g. filtered out), a stale or
 * absent one triggers the live fetch. No status filter: a recently retired
 * row still counts as "we already know this barcode".
 */
export async function findOffCachedFresh(barcode: string) {
  const source = await prisma.dataSource.findUnique({ where: { code: 'off' } });
  if (!source) return null;
  return prisma.food.findFirst({
    where: {
      sourceId: source.id,
      sourceKey: barcode,
      updatedAt: { gt: new Date(Date.now() - OFF_CACHE_TTL_MS) },
    },
    select: { id: true, updatedAt: true },
  });
}

/**
 * Upsert one OFF-API-normalized food into the library (runtime single-row
 * write — Prisma is fine here, unlike the bulk ETL path). Same shape the ETL
 * would produce: searchText via the shared builder, completeness as the
 * non-NULL share of the 12 core nutrients, contentHash over the normalized
 * payload so a future bulk OFF import can skip the row when unchanged.
 */
export async function cacheOffFood(normalized: NormalizedFood) {
  const source = await prisma.dataSource.findUnique({ where: { code: 'off' } });
  if (!source) {
    // Seed data missing — surfaces as INTERNAL at the MCP boundary.
    throw new Error('data_source "off" is not seeded');
  }

  let present = 0;
  const nutrientData: Partial<Record<NutrientColumn, number | null>> = {};
  for (const column of NUTRIENT_COLUMNS) {
    const value = normalized.nutrients[column];
    const clean = value !== undefined && value !== null && Number.isFinite(value) ? value : null;
    nutrientData[column] = clean;
    if (clean !== null && COMPLETENESS_COLUMNS.includes(column)) present += 1;
  }
  const completeness = Math.round((present / COMPLETENESS_COLUMNS.length) * 100) / 100;

  const portions = (normalized.portions ?? []).map((p) => ({
    seq: p.seq,
    description: p.description,
    gramWeight: p.gramWeight,
    sourcePortionId: p.sourcePortionId ?? null,
  }));

  const foodData = {
    dataType: normalized.dataType,
    name: normalized.name,
    nameEn: normalized.nameEn ?? null,
    nameZh: normalized.nameZh ?? null,
    aliases: normalized.aliases ?? null,
    brand: normalized.brand ?? null,
    category: normalized.category ?? null,
    barcode: normalized.barcode ?? null,
    ediblePct: normalized.ediblePct ?? null,
    searchText: buildSearchText({
      name: normalized.name,
      nameZh: normalized.nameZh,
      nameEn: normalized.nameEn,
      aliases: normalized.aliases,
      brand: normalized.brand,
    }),
    completeness,
    verified: true,
    status: 'active' as const,
    contentHash: contentHash(normalized),
    sourceMeta: { fetchedAt: new Date().toISOString() },
  };

  return prisma.food.upsert({
    where: {
      sourceId_sourceKey: { sourceId: source.id, sourceKey: normalized.sourceKey },
    },
    create: {
      sourceId: source.id,
      sourceKey: normalized.sourceKey,
      ...foodData,
      nutrients: { create: { ...nutrientData } },
      ...(portions.length > 0 ? { portions: { create: portions } } : {}),
    },
    update: {
      ...foodData,
      // All 39 columns are written every time (missing = NULL) so a refresh
      // clears values the product no longer reports.
      nutrients: {
        upsert: { create: { ...nutrientData }, update: { ...nutrientData } },
      },
      portions: { deleteMany: {}, ...(portions.length > 0 ? { create: portions } : {}) },
    },
    include: {
      source: true,
      nutrients: true,
      portions: { orderBy: { seq: 'asc' } },
    },
  });
}

export async function getFood(userId: string, foodId: bigint) {
  // No status filter: retired foods stay readable because diet logs may
  // still reference them; the result carries `status` so callers can tell.
  return prisma.food.findFirst({
    where: {
      id: foodId,
      OR: [{ createdByUserId: null }, { createdByUserId: userId }],
    },
    include: {
      source: true,
      nutrients: true,
      portions: { orderBy: { seq: 'asc' } },
    },
  });
}

// Keys mirror FoodNutrients columns so the object spreads straight into the
// nested create.
export interface Per100gInput {
  energyKcal: number;
  proteinG: number;
  fatG: number;
  carbG: number;
  fiberG?: number;
  sugarsG?: number;
  satFatG?: number;
  sodiumMg?: number;
  potassiumMg?: number;
  calciumMg?: number;
  ironMg?: number;
  cholesterolMg?: number;
}

const CORE_NUTRIENT_KEYS: (keyof Per100gInput)[] = [
  'energyKcal',
  'proteinG',
  'fatG',
  'carbG',
  'fiberG',
  'sugarsG',
  'satFatG',
  'sodiumMg',
  'potassiumMg',
  'calciumMg',
  'ironMg',
  'cholesterolMg',
];

export interface CreateCustomFoodInput {
  name: string;
  nameZh?: string;
  nameEn?: string;
  brand?: string;
  category?: string;
  aliases?: string[];
  per100g: Per100gInput;
  portions?: { description: string; gramWeight: number }[];
}

export async function createCustomFood(userId: string, input: CreateCustomFoodInput) {
  const aliases = input.aliases?.length ? input.aliases.join('|') : null;
  // Completeness = share of the core nutrient columns actually provided.
  const provided = CORE_NUTRIENT_KEYS.filter((k) => input.per100g[k] !== undefined).length;
  const completeness = Math.round((provided / CORE_NUTRIENT_KEYS.length) * 100) / 100;

  return prisma.$transaction(async (tx) => {
    const customSource = await tx.dataSource.findUnique({ where: { code: 'custom' } });
    if (!customSource) {
      // Seed data missing — surfaces as INTERNAL at the MCP boundary.
      throw new Error('data_source "custom" is not seeded');
    }
    return tx.food.create({
      data: {
        sourceId: customSource.id,
        sourceKey: randomUUID(),
        dataType: 'custom',
        name: input.name,
        nameZh: input.nameZh ?? null,
        nameEn: input.nameEn ?? null,
        brand: input.brand ?? null,
        category: input.category ?? null,
        aliases,
        searchText: buildSearchText({
          name: input.name,
          nameZh: input.nameZh,
          nameEn: input.nameEn,
          aliases,
          brand: input.brand,
        }),
        completeness,
        verified: false,
        createdByUserId: userId,
        nutrients: { create: { ...input.per100g } },
        ...(input.portions?.length
          ? {
              portions: {
                create: input.portions.map((p, i) => ({
                  seq: i,
                  description: p.description,
                  gramWeight: p.gramWeight,
                })),
              },
            }
          : {}),
      },
      include: {
        source: true,
        nutrients: true,
        portions: { orderBy: { seq: 'asc' } },
      },
    });
  });
}
