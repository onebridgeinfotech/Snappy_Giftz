import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticatorTransportFuture,
  type AuthenticationResponseJSON,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
  type RegistrationResponseJSON,
} from '@simplewebauthn/server';
import { prisma } from '@/lib/prisma';
import { getWebAuthnOrigins, getWebAuthnRpId, WEBAUTHN_RP_NAME } from './webauthn-config';

const CHALLENGE_TTL_MS = 5 * 60 * 1000;

function parseTransports(raw: unknown): AuthenticatorTransportFuture[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((t): t is AuthenticatorTransportFuture => typeof t === 'string');
}

export async function listUserPasskeys(userId: string) {
  const rows = await prisma.webAuthnCredential.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      nickname: true,
      deviceType: true,
      backedUp: true,
      createdAt: true,
      lastUsedAt: true,
    },
  });
  return rows.map((r) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
    lastUsedAt: r.lastUsedAt?.toISOString() ?? null,
  }));
}

export async function passkeyRegistrationOptions(userId: string): Promise<PublicKeyCredentialCreationOptionsJSON> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('USER_NOT_FOUND');

  const existing = await prisma.webAuthnCredential.findMany({ where: { userId } });
  const options = await generateRegistrationOptions({
    rpName: WEBAUTHN_RP_NAME,
    rpID: getWebAuthnRpId(),
    userName: user.email,
    userDisplayName: user.name,
    userID: new TextEncoder().encode(user.id),
    attestationType: 'none',
    excludeCredentials: existing.map((c) => ({
      id: c.credentialId,
      transports: parseTransports(c.transports),
    })),
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
      authenticatorAttachment: 'platform',
    },
  });

  await storeChallenge(userId, options.challenge, 'registration');
  return options;
}

export async function passkeyRegistrationVerify(
  userId: string,
  response: RegistrationResponseJSON,
  nickname?: string
): Promise<void> {
  const expectedChallenge = await consumeChallenge(userId, 'registration');
  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge,
    expectedOrigin: getWebAuthnOrigins(),
    expectedRPID: getWebAuthnRpId(),
    requireUserVerification: false,
  });

  if (!verification.verified || !verification.registrationInfo) {
    throw new Error('PASSKEY_REGISTER_FAILED');
  }

  const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;
  await prisma.webAuthnCredential.create({
    data: {
      userId,
      credentialId: credential.id,
      publicKey: Buffer.from(credential.publicKey),
      counter: BigInt(credential.counter),
      deviceType: credentialDeviceType,
      backedUp: credentialBackedUp,
      transports: response.response.transports || [],
      nickname: nickname?.slice(0, 64) || 'This device',
    },
  });
}

export async function passkeyAuthenticationOptions(email: string): Promise<{
  options: PublicKeyCredentialRequestOptionsJSON;
  challengeId: string;
}> {
  const normalized = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: normalized } });

  if (!user) {
    const options = await generateAuthenticationOptions({
      rpID: getWebAuthnRpId(),
      userVerification: 'preferred',
    });
    const challengeId = await storeChallenge(null, options.challenge, 'authentication');
    return { options, challengeId };
  }

  const creds = await prisma.webAuthnCredential.findMany({ where: { userId: user.id } });
  if (!creds.length) {
    throw new Error('NO_PASSKEYS');
  }

  const options = await generateAuthenticationOptions({
    rpID: getWebAuthnRpId(),
    userVerification: 'preferred',
    allowCredentials: creds.map((c) => ({
      id: c.credentialId,
      transports: parseTransports(c.transports),
    })),
  });

  const challengeId = await storeChallenge(user.id, options.challenge, 'authentication');
  return { options, challengeId };
}

export async function passkeyAuthenticationVerify(
  challengeId: string,
  response: AuthenticationResponseJSON
): Promise<{ userId: string }> {
  const row = await prisma.webAuthnChallenge.findUnique({ where: { id: challengeId } });
  if (!row || row.type !== 'authentication' || row.expiresAt < new Date()) {
    throw new Error('CHALLENGE_EXPIRED');
  }

  await prisma.webAuthnChallenge.delete({ where: { id: row.id } }).catch(() => undefined);

  const cred = await prisma.webAuthnCredential.findUnique({
    where: { credentialId: response.id },
  });
  if (!cred || (row.userId && cred.userId !== row.userId)) {
    throw new Error('UNKNOWN_PASSKEY');
  }

  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge: row.challenge,
    expectedOrigin: getWebAuthnOrigins(),
    expectedRPID: getWebAuthnRpId(),
    requireUserVerification: false,
    credential: {
      id: cred.credentialId,
      publicKey: new Uint8Array(cred.publicKey),
      counter: Number(cred.counter),
      transports: parseTransports(cred.transports),
    },
  });

  if (!verification.verified) {
    throw new Error('PASSKEY_VERIFY_FAILED');
  }

  await prisma.webAuthnCredential.update({
    where: { id: cred.id },
    data: {
      counter: BigInt(verification.authenticationInfo.newCounter),
      lastUsedAt: new Date(),
    },
  });

  const user = await prisma.user.findUnique({ where: { id: cred.userId } });
  if (!user || !user.isActive) {
    throw new Error('USER_INACTIVE');
  }

  return { userId: user.id };
}

export async function removeUserPasskey(userId: string, credentialRowId: string): Promise<void> {
  const res = await prisma.webAuthnCredential.deleteMany({
    where: { id: credentialRowId, userId },
  });
  if (!res.count) throw new Error('PASSKEY_NOT_FOUND');
}

async function storeChallenge(
  userId: string | null,
  challenge: string,
  type: 'registration' | 'authentication'
): Promise<string> {
  await prisma.webAuthnChallenge.deleteMany({
    where: {
      OR: [{ expiresAt: { lt: new Date() } }, ...(userId ? [{ userId, type }] : [])],
    },
  });

  const row = await prisma.webAuthnChallenge.create({
    data: {
      userId,
      challenge,
      type,
      expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS),
    },
  });
  return row.id;
}

async function consumeChallenge(userId: string, type: 'registration' | 'authentication'): Promise<string> {
  const row = await prisma.webAuthnChallenge.findFirst({
    where: { userId, type, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  });
  if (!row) throw new Error('CHALLENGE_EXPIRED');
  await prisma.webAuthnChallenge.delete({ where: { id: row.id } }).catch(() => undefined);
  return row.challenge;
}
