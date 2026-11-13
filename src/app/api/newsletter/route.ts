import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getClientIp } from '@/lib/security/client-ip';
import { enforceRateLimit } from '@/lib/security/rate-limit';

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as Record<string, any> | null;
    const limit = await enforceRateLimit('NEWSLETTER', getClientIp(req), { limit: 5, windowSeconds: 600 });
    if (!limit.allowed) return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
    if (typeof body?.website === 'string' && body.website.trim()) return NextResponse.json({ success: true }); // honeypot
    const email = String(body?.email || '').trim().toLowerCase().slice(0, 200);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
    const name = String(body?.name || '').trim().slice(0, 80) || null;
    await prisma.newsletterSubscriber.upsert({
      where: { email },
      create: { email, name, source: String(body?.source || 'blog').slice(0, 60) },
      update: { status: 'ACTIVE' },
    });
    return NextResponse.json({ success: true, message: "You're subscribed. Thank you!" }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
