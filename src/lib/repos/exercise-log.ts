import { prisma } from '@/lib/db';
import type {
  ExerciseLog,
  ExerciseCategory,
  ExerciseIntensity,
  ExerciseSource,
  Prisma,
} from '@/generated/prisma/client';

// Pure data access for the exercise-log domain. No auth, no MCP concerns:
// callers derive localDate before writing.

/** Fully derived column values for one exercise_log row (DB casing). */
export interface ExerciseLogWriteData {
  activity: string;
  category: ExerciseCategory | null;
  intensity: ExerciseIntensity | null;
  durationMin: number | null;
  distanceKm: number | null;
  energyKcal: number;
  extraMetrics: Record<string, number> | null;
  startedAt: Date;
  localDate: Date;
  timezone: string;
  source: ExerciseSource;
  confidence: number | null;
  originalDescription: string | null;
  note: string | null;
  createdBy: string | null;
}

export type ExerciseLogPatch = Partial<Omit<ExerciseLogWriteData, 'createdBy'>>;

export async function createExercises(
  userId: string,
  entries: ExerciseLogWriteData[],
): Promise<ExerciseLog[]> {
  return prisma.$transaction(
    entries.map((entry) =>
      prisma.exerciseLog.create({
        data: { userId, ...entry, extraMetrics: entry.extraMetrics ?? undefined },
      }),
    ),
  );
}

/** Only the provided fields are written; null when not owned by the user. */
export async function updateExercise(
  userId: string,
  logId: string,
  patch: ExerciseLogPatch,
): Promise<ExerciseLog | null> {
  const existing = await prisma.exerciseLog.findFirst({
    where: { id: logId, userId },
    select: { id: true },
  });
  if (!existing) return null;
  return prisma.exerciseLog.update({
    where: { id: logId },
    data: { ...patch, extraMetrics: patch.extraMetrics ?? undefined },
  });
}

export async function deleteExercises(
  userId: string,
  logIds: string[],
): Promise<{ deletedCount: number; notFound: string[] }> {
  const owned = await prisma.exerciseLog.findMany({
    where: { id: { in: logIds }, userId },
    select: { id: true },
  });
  const ownedIds = new Set(owned.map((row) => row.id));
  if (ownedIds.size > 0) {
    await prisma.exerciseLog.deleteMany({ where: { id: { in: [...ownedIds] }, userId } });
  }
  return {
    deletedCount: ownedIds.size,
    notFound: logIds.filter((id) => !ownedIds.has(id)),
  };
}

export interface ListExercisesParams {
  from: Date;
  to: Date;
  category?: ExerciseCategory;
  limit: number;
  /** Keyset position: rows strictly after this (startedAt DESC, id DESC) key. */
  cursorKey?: { startedAt: Date; id: string };
}

/** Ordered by (startedAt DESC, id DESC); returns up to limit + 1 rows. */
export async function listExercises(
  userId: string,
  { from, to, category, limit, cursorKey }: ListExercisesParams,
): Promise<ExerciseLog[]> {
  const where: Prisma.ExerciseLogWhereInput = {
    userId,
    localDate: { gte: from, lte: to },
    ...(category ? { category } : {}),
    ...(cursorKey
      ? {
          OR: [
            { startedAt: { lt: cursorKey.startedAt } },
            { startedAt: cursorKey.startedAt, id: { lt: cursorKey.id } },
          ],
        }
      : {}),
  };
  return prisma.exerciseLog.findMany({
    where,
    orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
  });
}

/** Raw per-day exercise totals for get_daily_summary. */
export async function dailyExerciseTotals(userId: string, range: { from: Date; to: Date }) {
  return prisma.exerciseLog.groupBy({
    by: ['localDate'],
    where: { userId, localDate: { gte: range.from, lte: range.to } },
    _count: { _all: true },
    _sum: { energyKcal: true, durationMin: true },
  });
}
