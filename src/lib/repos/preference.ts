import { prisma } from '@/lib/db';
import type {
  AllergenSeverity,
  DietType,
  DietaryPreference,
  PreferenceKind,
  PreferenceTag,
  UserAllergen,
} from '@/generated/prisma/client';

export interface PreferencesSnapshot {
  dietaryPreference: DietaryPreference | null;
  allergens: UserAllergen[];
  tags: PreferenceTag[];
}

export interface AllergenInput {
  allergen: string;
  severity: AllergenSeverity;
  note?: string;
}

export interface TagInput {
  kind: PreferenceKind;
  label: string;
  note?: string;
}

// Field-level replacement semantics: a field left undefined is untouched;
// a provided array replaces the user's whole set for that field.
export interface PreferencesPatch {
  dietType?: DietType | null;
  religiousDiets?: string[];
  note?: string | null;
  allergens?: AllergenInput[];
  tags?: TagInput[];
}

export async function getPreferences(userId: string): Promise<PreferencesSnapshot> {
  const [dietaryPreference, allergens, tags] = await Promise.all([
    prisma.dietaryPreference.findUnique({ where: { userId } }),
    prisma.userAllergen.findMany({ where: { userId }, orderBy: { allergen: 'asc' } }),
    prisma.preferenceTag.findMany({
      where: { userId },
      orderBy: [{ kind: 'asc' }, { label: 'asc' }],
    }),
  ]);
  return { dietaryPreference, allergens, tags };
}

export async function replacePreferences(
  userId: string,
  patch: PreferencesPatch,
): Promise<PreferencesSnapshot> {
  return prisma.$transaction(async (tx) => {
    const touchesDietary =
      patch.dietType !== undefined ||
      patch.religiousDiets !== undefined ||
      patch.note !== undefined;

    if (touchesDietary) {
      await tx.dietaryPreference.upsert({
        where: { userId },
        create: {
          userId,
          dietType: patch.dietType ?? null,
          religiousDiets: patch.religiousDiets ?? [],
          note: patch.note ?? null,
        },
        update: {
          ...(patch.dietType !== undefined ? { dietType: patch.dietType } : {}),
          ...(patch.religiousDiets !== undefined
            ? { religiousDiets: patch.religiousDiets }
            : {}),
          ...(patch.note !== undefined ? { note: patch.note } : {}),
        },
      });
    }

    if (patch.allergens !== undefined) {
      await tx.userAllergen.deleteMany({ where: { userId } });
      if (patch.allergens.length > 0) {
        await tx.userAllergen.createMany({
          data: patch.allergens.map((a) => ({
            userId,
            allergen: a.allergen,
            severity: a.severity,
            note: a.note ?? null,
          })),
        });
      }
    }

    if (patch.tags !== undefined) {
      await tx.preferenceTag.deleteMany({ where: { userId } });
      if (patch.tags.length > 0) {
        await tx.preferenceTag.createMany({
          data: patch.tags.map((t) => ({
            userId,
            kind: t.kind,
            label: t.label,
            note: t.note ?? null,
          })),
        });
      }
    }

    const [dietaryPreference, allergens, tags] = await Promise.all([
      tx.dietaryPreference.findUnique({ where: { userId } }),
      tx.userAllergen.findMany({ where: { userId }, orderBy: { allergen: 'asc' } }),
      tx.preferenceTag.findMany({
        where: { userId },
        orderBy: [{ kind: 'asc' }, { label: 'asc' }],
      }),
    ]);
    return { dietaryPreference, allergens, tags };
  });
}
