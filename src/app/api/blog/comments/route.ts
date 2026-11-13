import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getClientIp } from '@/lib/security/client-ip';
import { enforceRateLimit } from '@/lib/security/rate-limit';

/** Public comment submission. Comments are held as PENDING until an editor approves them. */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as Record<string, any> | null;
    if (!body) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    const ip = getClientIp(req);
    const limit = await enforceRateLimit('BLOG_COMMENT', ip, { limit: 5, windowSeconds: 600 });
    if (!limit.allowed) return NextResponse.json({ error: 'Too many comments. Please try again later.' }, { status: 429 });

    // Honeypot: bots fill the hidden "website" field
    if (typeof body.website === 'string' && body.website.trim()) return NextResponse.json({ success: true });

    const name = String(body.name || '').trim().slice(0, 80);
    const text = String(body.body || '').trim().slice(0, 2000);
    const email = String(body.email || '').trim().slice(0, 200);
    if (name.length < 2 || text.length < 3) return NextResponse.json({ error: 'Please enter your name and a comment.' }, { status: 400 });
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: 'Invalid email address.' }, { status: 400 });
    if ((text.match(/https?:\/\//g) || []).length > 2) return NextResponse.json({ error: 'Too many links in comment.' }, { status: 400 });

    const post = await prisma.blogPost.findFirst({ where: { slug: String(body.slug || ''), status: 'PUBLISHED' }, select: { id: true } });
    if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 });

    await prisma.blogComment.create({
      data: { postId: post.id, authorName: name, email: email || null, body: text, ipHash: crypto.createHash('sha256').update(ip).digest('hex').slice(0, 32) },
    });
    return NextResponse.json({ success: true, message: 'Thanks! Your comment will appear after review.' }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
