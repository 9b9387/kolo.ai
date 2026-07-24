import 'dotenv/config';
import { prisma } from '../src/lib/db';

// Licensing facts for every food source. attributionText is returned verbatim
// by the MCP food tools; keep wording aligned with NOTICE.md.
const DATA_SOURCES = [
  {
    code: 'usda_fdc',
    name: 'USDA FoodData Central',
    license: 'CC0-1.0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    attributionText:
      'U.S. Department of Agriculture (USDA), Agricultural Research Service. FoodData Central. fdc.nal.usda.gov.',
    attributionUrl: 'https://fdc.nal.usda.gov',
    requiresShareAlike: false,
    redistributable: true,
  },
  {
    code: 'off',
    name: 'Open Food Facts',
    license: 'ODbL-1.0',
    licenseUrl: 'https://opendatacommons.org/licenses/odbl/1-0/',
    attributionText:
      'Data from Open Food Facts (openfoodfacts.org), © Open Food Facts contributors, licensed under the Open Database License (ODbL) v1.0.',
    attributionUrl: 'https://world.openfoodfacts.org',
    requiresShareAlike: true,
    redistributable: true,
  },
  {
    code: 'cfct',
    name: '中国食物成分表（用户自备数据）',
    license: 'user-provided',
    licenseUrl: null,
    attributionText:
      '数据来自用户自备《中国食物成分表》录入，仅限本实例内部使用，不可再分发。',
    attributionUrl: null,
    requiresShareAlike: false,
    redistributable: false,
  },
  {
    code: 'custom',
    name: 'User-created foods',
    license: 'user-provided',
    licenseUrl: null,
    attributionText: 'Created by the owning user via the Kolo MCP interface.',
    attributionUrl: null,
    requiresShareAlike: false,
    redistributable: false,
  },
] as const;

async function main() {
  for (const source of DATA_SOURCES) {
    await prisma.dataSource.upsert({
      where: { code: source.code },
      update: { ...source },
      create: { ...source },
    });
  }
  const count = await prisma.dataSource.count();
  console.log(`Seeded data_source (${count} rows).`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
