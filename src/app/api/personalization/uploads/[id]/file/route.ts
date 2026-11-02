import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getOptionalUser } from '@/lib/auth/rbac';
import { Role } from '@prisma/client';
import { getArtworkRecord } from '@/lib/personalization/personalization.service';
import { privateStorageService } from '@/services/storage/private-storage.service';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const artwork = await getArtworkRecord(id);

    if (!artwork) {
      return NextResponse.json({ error: 'Artwork upload not found.' }, { status: 404 });
    }

    const url = new URL(req.url);

    // Reject token-based query-string access to prevent token leakage in URLs, browser history, and server logs
    if (url.searchParams.has('token')) {
      return NextResponse.json(
        { error: 'Query-string token access is forbidden. Pass token in x-guest-token header instead.' },
        { status: 403 }
      );
    }

    const user = await getOptionalUser(req);
    const guestToken = req.headers.get('x-guest-token');

    // Access Control Guard:
    // 1. Staff / Admin can inspect any customer artwork proof
    // 2. Owning user can access their own artwork
    // 3. Guest with valid matching guest token in x-guest-token header can access their artwork
    const isStaffOrAdmin = user && (user.role === Role.ADMIN || user.role === Role.STAFF);
    const isOwnerUser = user && artwork.uploadedByUserId && user.id === artwork.uploadedByUserId;

    let isOwnerGuest = false;
    if (guestToken && artwork.guestSessionToken) {
      try {
        const hashA = crypto.createHash('sha256').update(guestToken).digest();
        const hashB = crypto.createHash('sha256').update(artwork.guestSessionToken).digest();
        if (crypto.timingSafeEqual(hashA, hashB)) {
          isOwnerGuest = true;
        }
      } catch {
        // Fallback safely
      }
    }

    if (!isStaffOrAdmin && !isOwnerUser && !isOwnerGuest) {
      return NextResponse.json(
        { error: 'Unauthorized access to private customer artwork.' },
        { status: 403 }
      );
    }

    const fileBuffer = await privateStorageService.getPrivateFileBuffer(artwork.fileKey);

    return new Response(new Uint8Array(fileBuffer), {
      status: 200,
      headers: {
        'Content-Type': artwork.mimeType,
        'Content-Length': String(fileBuffer.length),
        'Cache-Control': 'private, no-transform, max-age=3600',
        'Content-Disposition': `inline; filename="${artwork.originalFilename}"`,
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to stream private artwork.' },
      { status: 500 }
    );
  }
}
