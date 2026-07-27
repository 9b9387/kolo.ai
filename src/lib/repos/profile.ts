import { prisma } from '@/lib/db';

// Field names mirror the Prisma model. `undefined` means "leave unchanged"
// (Prisma skips undefined fields), `null` clears a nullable column.
export interface ProfileData {
  sex?: 'male' | 'female' | 'other';
  calcAs?: 'male' | 'female' | 'average' | null;
  birthDate?: Date;
  heightCm?: number;
  activityLevel?:
    | 'sedentary'
    | 'lightly_active'
    | 'moderately_active'
    | 'very_active'
    | 'extra_active';
  customActivityFactor?: number | null;
  timezone?: string;
  nutrientRefStandard?: 'cn_nrv' | 'us_dri' | null;
  note?: string | null;
}

export function getProfile(userId: string) {
  return prisma.userProfile.findUnique({ where: { userId } });
}

// Partial upsert: only the provided (non-undefined) fields are written.
export function upsertProfile(userId: string, data: ProfileData) {
  return prisma.userProfile.upsert({
    where: { userId },
    update: data,
    create: { userId, ...data },
  });
}
