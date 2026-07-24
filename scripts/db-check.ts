import 'dotenv/config';
import { prisma } from '@/lib/db';

async function main() {
  const rows = await prisma.$queryRawUnsafe(
    'SELECT VERSION() AS version, @@ngram_token_size AS ngram_token_size, @@character_set_server AS charset',
  );
  console.log(JSON.stringify(rows, (_, v) => (typeof v === 'bigint' ? v.toString() : v), 2));
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
