import 'dotenv/config';
import { prisma } from '../src/lib/prisma';
import { hashPassword, validatePasswordStrength } from '../src/lib/auth/password';
import { Role } from '@prisma/client';
import crypto from 'node:crypto';

async function bootstrapAdmin() {
  console.log('--- Snappy Gifts: Admin Bootstrap Procedure ---');

  const email = (
    process.env.ADMIN_EMAIL ||
    process.env.ADMIN_BOOTSTRAP_EMAIL ||
    'ezonetechnologies2124@gmail.com'
  ).trim().toLowerCase();

  let password = process.env.ADMIN_BOOTSTRAP_PASSWORD || '';

  if (!email || !email.includes('@')) {
    console.error('Error: Please provide a valid email via ADMIN_EMAIL or ADMIN_BOOTSTRAP_EMAIL.');
    process.exit(1);
  }

  // If password not provided in environment, generate a cryptographically strong 16-character password
  let wasGenerated = false;
  if (!password) {
    password = `Admin!${crypto.randomBytes(6).toString('hex')}9#`;
    wasGenerated = true;
    console.log(`Notice: No ADMIN_BOOTSTRAP_PASSWORD provided. Generated a secure one-time password.`);
  }

  const validation = validatePasswordStrength(password);
  if (!validation.isValid) {
    console.error(`Error: Password validation failed - ${validation.error}`);
    process.exit(1);
  }

  try {
    const existingAdmin = await prisma.user.findFirst({
      where: { role: Role.ADMIN },
    });

    if (existingAdmin && existingAdmin.email !== email) {
      console.warn(`[NOTICE] Existing administrator (${existingAdmin.email}) is already configured.`);
    }

    const hashedPassword = await hashPassword(password);

    const user = await prisma.user.upsert({
      where: { email },
      update: {
        role: Role.ADMIN,
        passwordHash: hashedPassword,
        isActive: true,
        isEmailVerified: true,
      },
      create: {
        email,
        name: 'SNAPPY GIFTZ Operations Administrator',
        role: Role.ADMIN,
        passwordHash: hashedPassword,
        isActive: true,
        isEmailVerified: true,
      },
    });

    console.log(`\n✔ Administrator account successfully bootstrapped!`);
    console.log(`  User ID: ${user.id}`);
    console.log(`  Email:   ${user.email}`);
    console.log(`  Role:    ${user.role}`);
    if (wasGenerated) {
      console.log(`  One-time Password: ${password}`);
      console.log(`  (Save this password securely; it will not be displayed again.)`);
    } else {
      console.log(`  Password: [Set from environment variable]`);
    }
    console.log('--- Bootstrap Complete ---');
  } catch (error) {
    console.error('Database connection error during bootstrap:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

bootstrapAdmin();
