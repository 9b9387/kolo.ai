import { prisma } from '@/lib/db';
import type { DietLog, MealType, LogSource } from '@/generated/prisma/client';

// Pure data access for the diet-log domain. No auth, no MCP concerns:
// callers derive localDate / description snapshots before writing.

/** Fully derived column values for one diet_log row (DB casing). */
export interface DietLogWriteData {
  foodId: bigint | null;
  description: string | null;
  mealType: MealType;
  mealLabel: string | null;
  amountInput: number | null;
  unitInput: string | null;
  grams: number | null;
  energyKcal: number;
  proteinG: number;
  carbG: number;
  fatG: number;
  fiberG: number | null;
  sugarG: number | null;
  satFatG: number | null;
  sodiumMg: number | null;
  eatenAt: Date;
  localDate: Date;
  timezone: string;
  source: LogSource;
  confidence: number | null;
  originalDescription: string | null;
  note: string | null;
  createdBy: string | null;
}

export type DietLogPatch = Partial<Omit<DietLogWriteData, 'createdBy'>>;

/** Timezone stored on the user's profile, if any. */
export async function getProfileTimezone(userId: string): Promise<string | null> {
  const profile = await prisma.userProfile.findUnique({
    where: { userId },
    select: { timezone: true },
  });
  return profile?.timezone ?? null;
}

/**
 * Foods the user may reference from a log: any status (retired foods stay
 * loggable for history edits), public rows or the user's own custom foods.
 * Returns id -> name for the visible subset.
 */
export async function getVisibleFoodNames(
  userId: string,
  foodIds: bigint[],
): Promise<Map<bigint, string>> {
  if (foodIds.length === 0) return new Map();
  const rows = await prisma.food.findMany({
    where: {
      id: { in: foodIds },
      OR: [{ createdByUserId: null }, { createdByUserId: userId }],
    },
    select: { id: true, name: true },
  });
  return new Map(rows.map((r) => [r.id, r.name]));
}

/** Batch insert; entries are already fully derived. Returns the created rows. */
export async function createLogs(userId: string, entries: DietLogWriteData[]): Promise<DietLog[]> {
  // createManyAndReturn is unavailable on MySQL; a transaction of creates
  // keeps the batch atomic and returns full rows.
  return prisma.$transaction(
    entries.map((entry) => prisma.dietLog.create({ data: { userId, ...entry } })),
  );
}

export async function getLog(userId: string, logId: string): Promise<DietLog | null> {
  return prisma.dietLog.findFirst({ where: { id: logId, userId } });
}

/** Updates only the provided fields. Returns null when the row is not the user's. */
export async function updateLog(
  userId: string,
  logId: string,
  patch: DietLogPatch,
): Promise<DietLog | null> {
  const { count } = await prisma.dietLog.updateMany({
    where: { id: logId, userId },
    data: patch,
  });
  if (count === 0) return null;
  return prisma.dietLog.findFirst({ where: { id: logId, userId } });
}

export async function deleteLogs(
  userId: string,
  logIds: string[],
): Promise<{ deletedCount: number; notFound: string[] }> {
  const existing = await prisma.dietLog.findMany({
    where: { userId, id: { in: logIds } },
    select: { id: true },
  });
  const existingIds = new Set(existing.map((r) => r.id));
  const notFound = logIds.filter((id) => !existingIds.has(id));
  if (existingIds.size === 0) return { deletedCount: 0, notFound };
  const { count } = await prisma.dietLog.deleteMany({
    where: { userId, id: { in: [...existingIds] } },
  });
  return { deletedCount: count, notFound };
}

export interface ListLogsParams {
  from: Date; // localDate lower bound (inclusive)
  to: Date; // localDate upper bound (inclusive)
  mealType?: MealType;
  foodId?: bigint;
  limit: number; // rows to fetch (caller passes pageSize + 1 to probe for more)
  cursorKey?: { eatenAt: Date; id: string };
}

/** Keyset-paginated listing ordered by (eatenAt DESC, id DESC). */
export async function listLogs(userId: string, params: ListLogsParams): Promise<DietLog[]> {
  const { from, to, mealType, foodId, limit, cursorKey } = params;
  return prisma.dietLog.findMany({
    where: {
      userId,
      localDate: { gte: from, lte: to },
      ...(mealType !== undefined ? { mealType } : {}),
      ...(foodId !== undefined ? { foodId } : {}),
      ...(cursorKey
        ? {
            OR: [
              { eatenAt: { lt: cursorKey.eatenAt } },
              { eatenAt: cursorKey.eatenAt, id: { lt: cursorKey.id } },
            ],
          }
        : {}),
    },
    orderBy: [{ eatenAt: 'desc' }, { id: 'desc' }],
    take: limit,
  });
}

/**
 * Raw per-day and per-(day, mealType) sums of the snapshot columns.
 * SUM over an all-NULL optional column is NULL, which is exactly the
 * "no data that day" signal the MCP layer passes through.
 */
export async function dailySummary(userId: string, range: { from: Date; to: Date }) {
  const where = { userId, localDate: { gte: range.from, lte: range.to } };
  const [byDay, byDayMeal] = await Promise.all([
    prisma.dietLog.groupBy({
      by: ['localDate'],
      where,
      _count: { _all: true },
      _sum: {
        energyKcal: true,
        proteinG: true,
        carbG: true,
        fatG: true,
        fiberG: true,
        sugarG: true,
        satFatG: true,
        sodiumMg: true,
      },
      orderBy: { localDate: 'asc' },
    }),
    prisma.dietLog.groupBy({
      by: ['localDate', 'mealType'],
      where,
      _count: { _all: true },
      _sum: {
        energyKcal: true,
        proteinG: true,
        carbG: true,
        fatG: true,
        fiberG: true,
        sugarG: true,
        satFatG: true,
        sodiumMg: true,
      },
      orderBy: [{ localDate: 'asc' }, { mealType: 'asc' }],
    }),
  ]);
  return { byDay, byDayMeal };
}
