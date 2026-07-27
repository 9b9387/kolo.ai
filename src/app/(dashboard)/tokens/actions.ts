'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth/better-auth';
import { prisma } from '@/lib/db';
import { generatePat } from '@/lib/auth/pat';
import { ALL_SCOPES } from '@/lib/auth/scopes';

const EXPIRY_DAYS = { '30': 30, '90': 90, '365': 365, never: null } as const;

async function requireUserId(): Promise<string> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/sign-in?redirect=/tokens');
  return session.user.id;
}

export type CreatePatState =
  | { status: 'idle' }
  | { status: 'error'; message: string }
  | { status: 'created'; token: string; name: string };

export async function createPatAction(
  _prev: CreatePatState,
  formData: FormData,
): Promise<CreatePatState> {
  const userId = await requireUserId();

  const name = String(formData.get('name') ?? '').trim();
  if (!name || name.length > 100) {
    return { status: 'error', message: 'Name is required (max 100 characters).' };
  }
  const expiry = String(formData.get('expiry') ?? '90');
  // Object.hasOwn, not `in`: prototype names (constructor, …) must not pass.
  if (!Object.hasOwn(EXPIRY_DAYS, expiry)) {
    return { status: 'error', message: 'Invalid expiry.' };
  }
  const days = EXPIRY_DAYS[expiry as keyof typeof EXPIRY_DAYS];

  const { token, tokenHash, lastFour } = generatePat();
  await prisma.personalAccessToken.create({
    data: {
      userId,
      name,
      tokenHash,
      lastFour,
      scopes: ALL_SCOPES,
      expiresAt: days ? new Date(Date.now() + days * 86_400_000) : null,
    },
  });

  revalidatePath('/tokens');
  return { status: 'created', token, name };
}

export async function revokePatAction(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const id = String(formData.get('id') ?? '');

  // Scoped to the session user; revoking twice is a no-op.
  await prisma.personalAccessToken.updateMany({
    where: { id, userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  revalidatePath('/tokens');
}

// Hard delete — only for tokens that can no longer authenticate (revoked or
// expired). Active tokens must be revoked first so removal is a two-step,
// deliberate act.
export async function deletePatAction(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const id = String(formData.get('id') ?? '');

  await prisma.personalAccessToken.deleteMany({
    where: {
      id,
      userId,
      OR: [{ revokedAt: { not: null } }, { expiresAt: { lt: new Date() } }],
    },
  });

  revalidatePath('/tokens');
}
