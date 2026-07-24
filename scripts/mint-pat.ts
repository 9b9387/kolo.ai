import 'dotenv/config';
import { prisma } from '@/lib/db';
import { generatePat } from '@/lib/auth/pat';
import { ALL_SCOPES } from '@/lib/auth/scopes';

// Dev utility: mint a PAT for a user from the CLI.
//   npx tsx scripts/mint-pat.ts [email] [name]
// Prints the plaintext token once — same rules as the web UI.
async function main() {
  const [email, name = 'cli-minted'] = process.argv.slice(2);
  const user = email
    ? await prisma.user.findUnique({ where: { email } })
    : await prisma.user.findFirst();
  if (!user) throw new Error(email ? `no user with email ${email}` : 'no users in DB');

  const { token, tokenHash, lastFour } = generatePat();
  await prisma.personalAccessToken.create({
    data: { userId: user.id, name, tokenHash, lastFour, scopes: ALL_SCOPES },
  });
  console.error(`Minted "${name}" for ${user.email} (shown once):`);
  console.log(token);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
