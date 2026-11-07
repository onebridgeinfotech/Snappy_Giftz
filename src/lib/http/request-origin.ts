/**
 * Resolves the public site origin for OAuth redirect URIs behind reverse proxies (e.g. Hostinger).
 */
export function resolvePublicAppUrl(req: Request): string {
  const reqUrl = new URL(req.url);
  if (reqUrl.hostname === 'localhost' || reqUrl.hostname === '127.0.0.1') {
    const port = reqUrl.port ? `:${reqUrl.port}` : '';
    return `http://${reqUrl.hostname}${port}`;
  }

  const fromEnv = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '');
  if (fromEnv) return fromEnv;

  const forwardedHost = req.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  const forwardedProto = (req.headers.get('x-forwarded-proto') || 'https').split(',')[0]?.trim() || 'https';
  if (forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  if (reqUrl.hostname.endsWith('snappygiftz.com')) {
    return 'https://snappygiftz.com';
  }

  return reqUrl.origin;
}
