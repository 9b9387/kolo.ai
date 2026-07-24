import { prisma } from '@/lib/db';

export type GoalTypeValue =
  | 'fat_loss'
  | 'muscle_gain'
  | 'maintenance'
  | 'recomposition'
  | 'performance'
  | 'health';

// `undefined` means "leave unchanged", `null` clears a nullable column.
export interface GoalWriteData {
  targetWeightKg?: number | null;
  weeklyRateKg?: number | null;
  targetDate?: Date | null;
  dailyCalorieTarget?: number | null;
  proteinTargetG?: number | null;
  carbTargetG?: number | null;
  fatTargetG?: number | null;
  fiberTargetG?: number | null;
  waterTargetMl?: number | null;
  rationale?: string | null;
}

export interface GoalCreateData extends GoalWriteData {
  goalType: GoalTypeValue;
}

export interface GoalUpdateData extends GoalWriteData {
  goalType?: GoalTypeValue;
}

export function getActiveGoal(userId: string) {
  return prisma.goal.findFirst({
    where: { userId, isActive: true },
    orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
  });
}

// Keyset pagination on (startedAt DESC, id DESC).
export function listGoals(
  userId: string,
  opts: {
    includeEnded: boolean;
    limit: number;
    cursorKey?: [startedAtIso: string, id: string];
  },
) {
  const { includeEnded, limit, cursorKey } = opts;
  return prisma.goal.findMany({
    where: {
      userId,
      ...(includeEnded ? {} : { isActive: true }),
      ...(cursorKey
        ? {
            OR: [
              { startedAt: { lt: new Date(cursorKey[0]) } },
              { startedAt: new Date(cursorKey[0]), id: { lt: cursorKey[1] } },
            ],
          }
        : {}),
    },
    orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
    take: limit,
  });
}

// At most one active goal per user. The transaction archives the current
// active goal(s) first; the unique index on activeKey (= userId while
// active, NULL once archived) makes the invariant hold even under
// concurrent set_goal calls — the loser fails on P2002 and the caller
// simply retries.
export async function createGoal(userId: string, data: GoalCreateData) {
  try {
    return await attemptCreateGoal(userId, data);
  } catch (err) {
    if ((err as { code?: string })?.code === 'P2002') {
      return attemptCreateGoal(userId, data);
    }
    throw err;
  }
}

function attemptCreateGoal(userId: string, data: GoalCreateData) {
  return prisma.$transaction(async (tx) => {
    const now = new Date();
    await tx.goal.updateMany({
      where: { userId, isActive: true },
      data: { isActive: false, activeKey: null, endedAt: now },
    });
    return tx.goal.create({
      data: { userId, ...data, activeKey: userId, startedAt: now },
    });
  });
}

// Only the provided fields are written. Returns null when the goal does not
// exist or belongs to another user (caller maps that to NOT_FOUND).
export async function updateGoal(userId: string, goalId: string, data: GoalUpdateData) {
  const existing = await prisma.goal.findFirst({
    where: { id: goalId, userId },
    select: { id: true },
  });
  if (!existing) return null;
  return prisma.goal.update({ where: { id: goalId }, data });
}
