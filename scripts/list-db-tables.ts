import { prisma } from '../src/lib/prisma';

async function listTables() {
  const tables: any = await prisma.$queryRawUnsafe('SHOW TABLES');
  console.log('Tables in Hostinger MariaDB:');
  for (const t of tables) {
    console.log('  -', Object.values(t)[0]);
  }
}

listTables().catch(console.error);

