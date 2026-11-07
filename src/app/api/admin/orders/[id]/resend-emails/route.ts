import { NextResponse } from 'next/server';
import { requireRole, AuthError } from '@/lib/auth/rbac';
import { Role } from '@prisma/client';
import { adminResendOrderEmails } from '@/lib/orders/order-email-notifications';
import { processEmailOutbox } from '@/lib/email/email-outbox.service';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/admin/orders/[id]/resend-emails
 * Queues a fresh customer receipt (and paid admin alerts) for the order.
 * Uses the linked account email when checkout left a stale guest/demo address.
 */
export async function POST(req: Request, context: RouteContext) {
  try {
    const user = await requireRole([Role.ADMIN, Role.STAFF], req);
    const { id } = await context.params;
    const cleanId = id?.trim();
    if (!cleanId) {
      return NextResponse.json({ error: 'Order id is required.' }, { status: 400 });
    }

    const result = await adminResendOrderEmails(cleanId);
    if (!result.ok) {
      return NextResponse.json({ error: result.error || 'Resend failed.' }, { status: result.status || 404 });
    }

    const dispatch = await processEmailOutbox({
      batchSize: 10,
      workerId: `admin-resend-${user.id}-${Date.now()}`,
    });

    return NextResponse.json({
      success: true,
      data: {
        orderNumber: result.orderNumber,
        recipientEmail: result.recipientEmail,
        dispatch,
      },
      message: `Order emails queued to ${result.recipientEmail}. Processed ${dispatch.sentCount} sent, ${dispatch.failedCount} failed.`,
    });
  } catch (error: any) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json(
      { error: error?.message || 'Failed to resend order emails.' },
      { status: 500 }
    );
  }
}
