/**
 * Centralized Client IP Resolution Engine
 * Safeguards against IP spoofing via forged X-Forwarded-For headers.
 */
export function getClientIp(req: Request): string {
  // 1. Prefer platform-level headers from verified reverse proxies (Vercel, Cloudflare)
  const realIp = req.headers.get('x-real-ip')?.trim();
  if (realIp && isValidIp(realIp)) {
    return realIp;
  }

  const cfIp = req.headers.get('cf-connecting-ip')?.trim();
  if (cfIp && isValidIp(cfIp)) {
    return cfIp;
  }

  // 2. If x-forwarded-for is present, take the rightmost or leftmost validated IP
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const parts = forwardedFor.split(',').map((p) => p.trim()).filter(Boolean);
    // Vercel appends the true client IP to the end or beginning
    for (const p of parts) {
      if (isValidIp(p) && !isPrivateIp(p)) {
        return p;
      }
    }
    if (parts.length > 0 && isValidIp(parts[0])) {
      return parts[0];
    }
  }

  return '127.0.0.1';
}

function isValidIp(ip: string): boolean {
  // IPv4 simple regex or IPv6 check
  const ipv4 = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/;
  const ipv6 = /^[0-9a-fA-F:]+$/;
  return ipv4.test(ip) || ipv6.test(ip);
}

function isPrivateIp(ip: string): boolean {
  return (
    ip.startsWith('10.') ||
    ip.startsWith('192.168.') ||
    ip.startsWith('172.16.') ||
    ip === '127.0.0.1' ||
    ip === '::1'
  );
}

