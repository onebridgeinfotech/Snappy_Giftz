/**
 * Sanitizes and validates post-authentication redirection targets.
 *
 * Ensures that redirect destinations are safe internal relative paths,
 * preventing Open Redirect vulnerabilities and authentication loops.
 */
export function getSafeRedirectUrl(target?: string | null, fallback: string = '/'): string {
  if (!target || typeof target !== 'string') {
    return fallback;
  }

  const trimmed = target.trim();
  if (!trimmed) {
    return fallback;
  }

  // Must start with a single forward slash
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.startsWith('/\\') || trimmed.startsWith('\\')) {
    return fallback;
  }

  // Prevent scheme injection or protocol indicators (e.g. "javascript:", "data:", "https:")
  // and discard strings with line breaks, null bytes, or backslashes
  if (/[\r\n\0\\]/.test(trimmed) || /^\/[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
    return fallback;
  }

  // Parse path component to avoid loops back to authentication / recovery pages
  const pathname = trimmed.split('?')[0].split('#')[0].toLowerCase();
  if (
    pathname === '/login' ||
    pathname === '/register' ||
    pathname === '/reset-password' ||
    pathname === '/forgot-password'
  ) {
    return fallback;
  }

  return trimmed;
}
