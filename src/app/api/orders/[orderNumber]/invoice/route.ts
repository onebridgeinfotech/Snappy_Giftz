import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getOptionalUser } from '@/lib/auth/rbac';
import { prisma } from '@/lib/prisma';
import { DEV_ORDERS_STORE } from '@/lib/orders/order.service';
import { isStorefrontFallbackAllowed } from '@/lib/catalog/public-catalog.service';
import {
  getInvoiceForOrder,
  issueTaxInvoice,
  getInvoicePdfBuffer,
  isRetailB2COrder,
  isOrderPaidForInvoice,
} from '@/lib/invoices/invoice.service';

/**
 * GET /api/orders/[orderNumber]/invoice
 * 
 * Secure, authorized tax invoice download endpoint.
 * Enforces ownership via active user session or header-based guest token.
 * Strictly ignores query-string tokens to prevent URL leakage in history and server logs.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  try {
    const { orderNumber } = await params;
    const cleanNum = orderNumber?.trim();
    if (!cleanNum) {
      return NextResponse.json({ error: 'Order reference is required.' }, { status: 400 });
    }

    // 1. Fetch Order to determine ownership
    let order: any = null;
    try {
      order = await prisma.order.findUnique({
        where: { orderNumber: cleanNum },
      });
    } catch {
      // Fallback
    }

    if (!order && isStorefrontFallbackAllowed() && DEV_ORDERS_STORE.has(cleanNum)) {
      order = DEV_ORDERS_STORE.get(cleanNum)!;
    }

    if (!order) {
      return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
    }

    // 2. Authorization Check
    const user = await getOptionalUser(req);
    const guestTokenHeader = req.headers.get('x-guest-token')?.trim();

    let isAuthorized = false;

    let isStaffOrAdmin = false;
    if (user) {
      isStaffOrAdmin = user.role === 'ADMIN' || user.role === 'STAFF';
      const isOwner = order.userId === user.id;
      if (isStaffOrAdmin || isOwner) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized && guestTokenHeader && order.guestLookupToken) {
      // Header-based constant-time guest token verification
      try {
        const headerHash = crypto.createHash('sha256').update(guestTokenHeader).digest();
        const expectedHash = crypto.createHash('sha256').update(order.guestLookupToken).digest();
        if (crypto.timingSafeEqual(headerHash, expectedHash)) {
          isAuthorized = true;
        }
      } catch {
        // Safe rejection on invalid inputs
      }
    }

    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'Unauthorized to access this tax invoice. Valid login session or x-guest-token header required.' },
        { status: 401 }
      );
    }

    // 3. Retrieve or Generate Invoice Record
    let invoice = await getInvoiceForOrder(cleanNum);

    if (!invoice) {
      // If order is paid/confirmed, issue the tax invoice on demand
      const canIssue =
        order.paymentStatus === 'PAID' ||
        order.paymentStatus === 'CAPTURED' ||
        ['CONFIRMED', 'IN_CUSTOMIZATION', 'QUALITY_CHECK', 'DISPATCHED', 'DELIVERED'].includes(order.orderStatus);

      if (canIssue) {
        invoice = await issueTaxInvoice(cleanNum);
      } else {
        return NextResponse.json(
          { error: 'Tax invoice is not yet available for this order.' },
          { status: 404 }
        );
      }
    }

    // 3b. Customer Delivery Safeguard (CGST Rule 46(q)):
    // Where physical signature is required, do NOT release an unsigned PDF with a blank signature line
    // to customers as the final signed invoice. Retain the document until authorized staff completes
    // physical printing, signature, and verification before courier handover.
    // Authorized staff/admin MAY download the printable draft for physical signing at the warehouse.
    if (!isStaffOrAdmin) {
      const physicalCopyPending =
        invoice.signatureMode === 'PHYSICAL_SIGNATURE_ON_PRINT' &&
        !invoice.physicalSignatureConfirmedAt;
      const allowB2cComputerGenerated =
        isRetailB2COrder(order) && isOrderPaidForInvoice(order);

      if (physicalCopyPending && !allowB2cComputerGenerated) {
        return NextResponse.json(
          {
            error:
              'Tax invoice is undergoing physical signature verification by authorized dispatch staff prior to courier handover (CGST Rule 46(q)). The final authenticated invoice will be available for download once dispatched.',
            status: 'PENDING_PHYSICAL_SIGNATURE',
          },
          { status: 409 }
        );
      }
    }

    // 4. Retrieve PDF binary buffer from private storage
    const pdfBuffer = await getInvoicePdfBuffer(invoice);
    const safeFilename = `${invoice.invoiceNumber.replace(/[\/\\]/g, '_')}.pdf`;

    return new Response(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${safeFilename}"`,
        'Content-Length': String(pdfBuffer.length),
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
      },
    });
  } catch (error: any) {
    console.error('[INVOICE_DOWNLOAD_API:ERROR]', error?.message || error);
    return NextResponse.json(
      { error: error?.message || 'Failed to download tax invoice.' },
      { status: 500 }
    );
  }
}
