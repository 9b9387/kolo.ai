'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth/better-auth';
import { prisma } from '@/lib/db';

async function requireUserId(): Promise<string> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/sign-in?redirect=/connections');
  return session.user.id;
}

// Disconnect an OAuth client: drop every token (access + refresh die
// together — rows hold both) and the consent record, scoped to the session
// user. The oauth_application row stays — it is the client's DCR
// registration, not this user's grant, and reconnecting reuses it.
export async function disconnectClientAction(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const clientId = String(formData.get('clientId') ?? '');
  if (!clientId) return;

  await prisma.$transaction([
    prisma.oauthAccessToken.deleteMany({ where: { clientId, userId } }),
    prisma.oauthConsent.deleteMany({ where: { clientId, userId } }),
  ]);

  revalidatePath('/connections');
}
