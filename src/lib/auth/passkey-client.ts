'use client';

/** True when the browser can show Face ID / Touch ID / Android biometrics via WebAuthn. */
export function isPasskeySupported(): boolean {
  return typeof window !== 'undefined' && typeof PublicKeyCredential !== 'undefined';
}

export async function passkeyLogin(email: string): Promise<Response> {
  const { startAuthentication } = await import('@simplewebauthn/browser');
  const optionsRes = await fetch('/api/auth/passkeys/login/options', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim().toLowerCase() }),
  });
  const optionsData = await optionsRes.json();
  if (!optionsRes.ok) {
    throw new Error(optionsData.error || 'Could not start Face ID sign-in.');
  }

  const response = await startAuthentication({ optionsJSON: optionsData.options });
  return fetch('/api/auth/passkeys/login/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ challengeId: optionsData.challengeId, response }),
  });
}

export async function registerPasskey(nickname?: string): Promise<void> {
  const { startRegistration } = await import('@simplewebauthn/browser');
  const optionsRes = await fetch('/api/auth/passkeys/register/options', { method: 'POST' });
  const optionsData = await optionsRes.json();
  if (!optionsRes.ok) {
    throw new Error(optionsData.error || 'Could not start passkey setup.');
  }

  const response = await startRegistration({ optionsJSON: optionsData.options });
  const verifyRes = await fetch('/api/auth/passkeys/register/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ response, nickname }),
  });
  const verifyData = await verifyRes.json();
  if (!verifyRes.ok) {
    throw new Error(verifyData.error || 'Could not save passkey.');
  }
}
