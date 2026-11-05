import { prisma } from '@/lib/prisma';
import { isStorefrontFallbackAllowed } from '@/lib/catalog/public-catalog.service';
import { emailService } from '@/services/email/mailpit.service';
import { privateStorageService } from '@/services/storage/private-storage.service';
import crypto from 'crypto';

export interface EmailOutboxData {
  id: string;
  idempotencyKey: string;
  eventType: string;
  orderId?: string | null;
  orderNumber?: string | null;
  recipientEmail: string;
  recipientName?: string | null;
  subject: string;
  htmlBody: string;
  textBody?: string | null;
  attachmentKey?: string | null;
  attachmentFilename?: string | null;
  status: 'PENDING' | 'PROCESSING' | 'SENT' | 'FAILED';
  attempts: number;
  maxAttempts: number;
  lastError?: string | null;
  nextRetryAt?: Date | null;
  lockedAt?: Date | null;
  lockedBy?: string | null;
  sentAt?: Date | null;
  messageId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface EnqueueEmailParams {
  idempotencyKey: string;
  eventType: string;
  orderId?: string | null;
  orderNumber?: string | null;
  recipientEmail: string;
  recipientName?: string | null;
  subject: string;
  htmlBody: string;
  textBody?: string | null;
  attachmentKey?: string | null;
  attachmentFilename?: string | null;
  maxAttempts?: number;
}

// Development fallback store when database is offline
export const DEV_EMAIL_OUTBOX_STORE: Map<string, EmailOutboxData> = new Map();

let autoDispatchChain: Promise<void> = Promise.resolve();

/** Sends queued mail immediately after enqueue (disable with EMAIL_AUTO_DISPATCH=false). */
function scheduleEmailOutboxAutoDispatch(): void {
  if (process.env.EMAIL_AUTO_DISPATCH === 'false') return;
  autoDispatchChain = autoDispatchChain
    .then(() =>
      processEmailOutbox({ batchSize: 20, workerId: `auto-${process.pid}` }).then(() => undefined)
    )
    .catch((err) => {
      console.warn('[EMAIL_AUTO_DISPATCH]', err instanceof Error ? err.message : err);
    });
}

/**
 * Enqueues a transactional email into the persistent outbox table idempotently.
 * Never raises uncaught exceptions that would roll back order, dispatch, or invoice transactions.
 */
export async function enqueueTransactionalEmail(params: EnqueueEmailParams): Promise<EmailOutboxData> {
  const now = new Date();
  const maxAttempts = params.maxAttempts || 5;

  try {
    // 1. Check for existing idempotency key in DB
    const existing = await prisma.emailOutbox.findUnique({
      where: { idempotencyKey: params.idempotencyKey },
    });
    if (existing) {
      return existing as unknown as EmailOutboxData;
    }

    const created = await prisma.emailOutbox.create({
      data: {
        idempotencyKey: params.idempotencyKey,
        eventType: params.eventType,
        orderId: params.orderId || null,
        orderNumber: params.orderNumber || null,
        recipientEmail: params.recipientEmail,
        recipientName: params.recipientName || null,
        subject: params.subject,
        htmlBody: params.htmlBody,
        textBody: params.textBody || null,
        attachmentKey: params.attachmentKey || null,
        attachmentFilename: params.attachmentFilename || null,
        status: 'PENDING',
        attempts: 0,
        maxAttempts,
        nextRetryAt: now,
      },
    });

    scheduleEmailOutboxAutoDispatch();
    return created as unknown as EmailOutboxData;
  } catch (err: any) {
    if (process.env.NODE_ENV === 'production' && !isStorefrontFallbackAllowed()) {
      console.error('[EMAIL_OUTBOX:CRITICAL] Failed to enqueue email into PostgreSQL:', err?.message || err);
    }

    // In-memory fallback
    for (const item of DEV_EMAIL_OUTBOX_STORE.values()) {
      if (item.idempotencyKey === params.idempotencyKey) {
        return item;
      }
    }

    const id = `outbox-${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
    const fallbackRecord: EmailOutboxData = {
      id,
      idempotencyKey: params.idempotencyKey,
      eventType: params.eventType,
      orderId: params.orderId || null,
      orderNumber: params.orderNumber || null,
      recipientEmail: params.recipientEmail,
      recipientName: params.recipientName || null,
      subject: params.subject,
      htmlBody: params.htmlBody,
      textBody: params.textBody || null,
      attachmentKey: params.attachmentKey || null,
      attachmentFilename: params.attachmentFilename || null,
      status: 'PENDING',
      attempts: 0,
      maxAttempts,
      lastError: null,
      nextRetryAt: now,
      lockedAt: null,
      lockedBy: null,
      sentAt: null,
      messageId: null,
      createdAt: now,
      updatedAt: now,
    };

    DEV_EMAIL_OUTBOX_STORE.set(id, fallbackRecord);
    return fallbackRecord;
  }
}

export interface ProcessOutboxResult {
  processedCount: number;
  sentCount: number;
  failedCount: number;
  errors: string[];
}

/**
 * Concurrency-safe worker that dequeues, locks, and dispatches pending transactional emails.
 * Uses optimistic locking with timeout recovery for crashed workers.
 */
export async function processEmailOutbox(options?: {
  batchSize?: number;
  workerId?: string;
}): Promise<ProcessOutboxResult> {
  const batchSize = options?.batchSize || 10;
  const workerId = options?.workerId || `worker-${process.pid}-${crypto.randomBytes(4).toString('hex')}`;
  const now = new Date();
  const lockTimeoutMs = 5 * 60 * 1000; // 5 minutes lock expiry

  const result: ProcessOutboxResult = {
    processedCount: 0,
    sentCount: 0,
    failedCount: 0,
    errors: [],
  };

  try {
    // 1. Try real PostgreSQL processing
    const candidates = await prisma.emailOutbox.findMany({
      where: {
        OR: [
          { status: 'PENDING', nextRetryAt: { lte: now } },
          { status: 'PROCESSING', lockedAt: { lte: new Date(now.getTime() - lockTimeoutMs) } },
        ],
      },
      take: batchSize,
      orderBy: { createdAt: 'asc' },
    });

    for (const candidate of candidates) {
      // Atomic lock acquisition
      const locked = await prisma.emailOutbox.updateMany({
        where: {
          id: candidate.id,
          OR: [{ status: 'PENDING' }, { status: 'PROCESSING', lockedAt: candidate.lockedAt }],
        },
        data: {
          status: 'PROCESSING',
          lockedAt: now,
          lockedBy: workerId,
        },
      });

      if (locked.count === 0) {
        // Someone else grabbed it concurrently
        continue;
      }

      result.processedCount++;
      await dispatchSingleMessage(candidate as unknown as EmailOutboxData, result, true);
    }

    return result;
  } catch {
    // Fallback store processing
    const candidates: EmailOutboxData[] = [];
    for (const item of DEV_EMAIL_OUTBOX_STORE.values()) {
      const isPending = item.status === 'PENDING' && (!item.nextRetryAt || item.nextRetryAt <= now);
      const isStuck =
        item.status === 'PROCESSING' && item.lockedAt && item.lockedAt.getTime() < now.getTime() - lockTimeoutMs;

      if (isPending || isStuck) {
        candidates.push(item);
        if (candidates.length >= batchSize) break;
      }
    }

    for (const item of candidates) {
      item.status = 'PROCESSING';
      item.lockedAt = now;
      item.lockedBy = workerId;
      result.processedCount++;

      await dispatchSingleMessage(item, result, false);
    }

    return result;
  }
}

/**
 * Dispatches an individual outbox message with attachment handling and exponential backoff retry.
 */
async function dispatchSingleMessage(
  item: EmailOutboxData,
  result: ProcessOutboxResult,
  isDb: boolean
): Promise<void> {
  const currentAttempt = item.attempts + 1;
  const now = new Date();

  try {
    // Prepare attachments if required
    const attachments: Array<{ filename: string; content: Buffer; contentType: string }> = [];
    if (item.attachmentKey && item.attachmentFilename) {
      try {
        const fileBuf = await privateStorageService.getPrivateFileBuffer(item.attachmentKey);
        attachments.push({
          filename: item.attachmentFilename,
          content: fileBuf,
          contentType: 'application/pdf',
        });
      } catch (attErr: any) {
        console.warn(`[EMAIL_OUTBOX:ATTACHMENT] Warning: could not attach file ${item.attachmentKey}: ${attErr?.message}`);
      }
    }

    // Call provider
    const sendRes = await emailService.sendEmail({
      to: item.recipientEmail,
      subject: item.subject,
      html: item.htmlBody,
      text: item.textBody || undefined,
      attachments: attachments.length > 0 ? attachments : undefined,
    });

    if (sendRes.success) {
      if (isDb) {
        await prisma.emailOutbox.update({
          where: { id: item.id },
          data: {
            status: 'SENT',
            attempts: currentAttempt,
            sentAt: now,
            messageId: sendRes.messageId || `msg-${now.getTime()}`,
            lockedAt: null,
            lockedBy: null,
            lastError: null,
          },
        });
      } else {
        item.status = 'SENT';
        item.attempts = currentAttempt;
        item.sentAt = now;
        item.messageId = sendRes.messageId || `msg-${now.getTime()}`;
        item.lockedAt = null;
        item.lockedBy = null;
        item.lastError = null;
        DEV_EMAIL_OUTBOX_STORE.set(item.id, item);
      }
      result.sentCount++;
    } else {
      throw new Error(sendRes.error || 'Provider rejected email transmission');
    }
  } catch (err: any) {
    result.failedCount++;
    const safeErrorMsg = String(err?.message || 'Unknown email transmission error').substring(0, 500);
    result.errors.push(safeErrorMsg);

    const isTerminal = currentAttempt >= item.maxAttempts;
    const backoffSeconds = Math.min(3600, Math.pow(2, currentAttempt) * 30); // 1m, 2m, 4m, 8m... max 1h
    const nextRetryAt = new Date(now.getTime() + backoffSeconds * 1000);

    if (isDb) {
      try {
        await prisma.emailOutbox.update({
          where: { id: item.id },
          data: {
            status: isTerminal ? 'FAILED' : 'PENDING',
            attempts: currentAttempt,
            lastError: safeErrorMsg,
            nextRetryAt: isTerminal ? null : nextRetryAt,
            lockedAt: null,
            lockedBy: null,
          },
        });
      } catch (updateErr) {
        console.error('[EMAIL_OUTBOX] Failed to record error status in DB:', updateErr);
      }
    } else {
      item.status = isTerminal ? 'FAILED' : 'PENDING';
      item.attempts = currentAttempt;
      item.lastError = safeErrorMsg;
      item.nextRetryAt = isTerminal ? null : nextRetryAt;
      item.lockedAt = null;
      item.lockedBy = null;
      DEV_EMAIL_OUTBOX_STORE.set(item.id, item);
    }
  }
}

/**
 * Manually resets a failed email for immediate retry by staff/admin.
 */
export async function retryFailedEmail(outboxId: string): Promise<boolean> {
  try {
    const updated = await prisma.emailOutbox.update({
      where: { id: outboxId },
      data: {
        status: 'PENDING',
        attempts: 0,
        nextRetryAt: new Date(),
        lastError: null,
        lockedAt: null,
        lockedBy: null,
      },
    });
    return Boolean(updated);
  } catch {
    const item = DEV_EMAIL_OUTBOX_STORE.get(outboxId);
    if (item) {
      item.status = 'PENDING';
      item.attempts = 0;
      item.nextRetryAt = new Date();
      item.lastError = null;
      item.lockedAt = null;
      item.lockedBy = null;
      DEV_EMAIL_OUTBOX_STORE.set(outboxId, item);
      return true;
    }
    return false;
  }
}

/**
 * Retrieves outbox messages for admin monitoring.
 */
export async function getOutboxMessages(filter?: {
  status?: string;
  orderNumber?: string;
  limit?: number;
}): Promise<EmailOutboxData[]> {
  const limit = filter?.limit || 50;

  try {
    const where: any = {};
    if (filter?.status) where.status = filter.status;
    if (filter?.orderNumber) where.orderNumber = filter.orderNumber;

    const list = await prisma.emailOutbox.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return list as unknown as EmailOutboxData[];
  } catch {
    const results: EmailOutboxData[] = [];
    for (const item of DEV_EMAIL_OUTBOX_STORE.values()) {
      if (filter?.status && item.status !== filter.status) continue;
      if (filter?.orderNumber && item.orderNumber !== filter.orderNumber) continue;
      results.push(item);
    }
    results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return results.slice(0, limit);
  }
}
