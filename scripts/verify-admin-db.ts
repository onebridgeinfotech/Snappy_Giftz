import { prisma } from '../src/lib/prisma';

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: 'ezonetechnologies2124@gmail.com' },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      isEmailVerified: true,
      passwordHash: true,
      createdAt: true,
      updatedAt: true
    }
  });

  console.log('Database User Record:');
  console.log('ID:', user?.id);
  console.log('Name:', user?.name);
  console.log('Email:', user?.email);
  console.log('Role:', user?.role);
  console.log('IsActive:', user?.isActive);
  console.log('Password Hashed with bcrypt?:', user?.passwordHash?.startsWith('$2'));
  console.log('Password Hash length:', user?.passwordHash?.length);
  console.log('Password Hash sample:', user?.passwordHash?.substring(0, 15) + '...');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

