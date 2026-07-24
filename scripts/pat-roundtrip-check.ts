import 'dotenv/config';
import { prisma } from '@/lib/db';
import { generatePat, hashPat } from '@/lib/auth/pat';
import { ALL_SCOPES } from '@/lib/auth/scopes';

// Exercises the PAT lifecycle against the dev database:
// create → O(1) hash lookup → revoke → lookup rejects.
async function main() {
  const user = await prisma.user.findFirst();
  if (!user) throw new Error('No user in DB — sign up first.');

  const { token, tokenHash, lastFour } = generatePat();
  const created = await prisma.personalAccessToken.create({
    data: { userId: user.id, name: 'roundtrip-check', tokenHash, lastFour, scopes: ALL_SCOPES },
  });

  const found = await prisma.personalAccessToken.findUnique({
    where: { tokenHash: hashPat(token) },
  });
  if (!found || found.id !== created.id) throw new Error('hash lookup failed');
  if (found.revokedAt) throw new Error('fresh token must not be revoked');

  await prisma.personalAccessToken.update({
    where: { id: created.id },
    data: { revokedAt: new Date() },
  });
  const revoked = await prisma.personalAccessToken.findUnique({
    where: { tokenHash: hashPat(token) },
  });
  if (!revoked?.revokedAt) throw new Error('revocation not persisted');

  await prisma.personalAccessToken.delete({ where: { id: created.id } });
  console.log(`PAT roundtrip OK (token shape: ${token.slice(0, 9)}…${lastFour}, ${token.length} chars)`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
