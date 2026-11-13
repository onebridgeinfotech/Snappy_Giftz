import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { enqueueTransactionalEmail } from '@/lib/email/email-outbox.service';
import { getAdminNotificationEmails } from '@/config/business';
import { getClientIp } from '@/lib/security/client-ip';
import { enforceRateLimit } from '@/lib/security/rate-limit';
import { escapeHtml } from '@/lib/cms/markdown';

/** Lead form on product/service landing pages. Emails the admin inboxes through the outbox. */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as Record<string, any> | null;
    if (!body) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    const limit = await enforceRateLimit('CMS_ENQUIRY', getClientIp(req), { limit: 5, windowSeconds: 600 });
    if (!limit.allowed) return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
    if (typeof body.website === 'string' && body.website.trim()) return NextResponse.json({ success: true }); // honeypot

    const name = String(body.name || '').trim().slice(0, 80);
    const email = String(body.email || '').trim().slice(0, 200);
    const phone = String(body.phone || '').trim().slice(0, 30);
    const message = String(body.message || '').trim().slice(0, 2000);
    const page = String(body.page || '').trim().slice(0, 200);
    if (name.length < 2 || message.length < 5) return NextResponse.json({ error: 'Please enter your name and a short message.' }, { status: 400 });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && phone.replace(/\D/g, '').length < 8) {
      return NextResponse.json({ error: 'Please provide a valid email or phone number.' }, { status: 400 });
    }

    const html = `<p><strong>New enquiry from the website</strong></p><p>Page: ${escapeHtml(page)}</p><p>Name: ${escapeHtml(name)}<br/>Email: ${escapeHtml(email)}<br/>Phone: ${escapeHtml(phone)}</p><p>${escapeHtml(message).replace(/\n/g, '<br/>')}</p>`;
    const id = crypto.randomUUID();
    await Promise.all(
      getAdminNotificationEmails().map((to) =>
        enqueueTransactionalEmail({
          idempotencyKey: `cms-enquiry:${id}:${to}`,
          eventType: 'CMS_ENQUIRY',
          recipientEmail: to,
          subject: `Website enquiry from ${name}`,
          htmlBody: html,
          textBody: `Enquiry from ${name} <${email}> ${phone}\nPage: ${page}\n\n${message}`,
        })
      )
    );
    return NextResponse.json({ success: true, message: 'Thanks! Our team will get back to you shortly.' }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
