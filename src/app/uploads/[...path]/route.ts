import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const MIME_MAP: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: urlSegments } = await params;
    if (!urlSegments || urlSegments.length === 0) {
      return new NextResponse('File not found', { status: 404 });
    }

    const baseDir = path.resolve(process.cwd(), 'public', 'uploads');
    const targetFile = path.resolve(baseDir, ...urlSegments);

    // Prevent directory traversal attacks
    if (!targetFile.startsWith(baseDir + path.sep)) {
      return new NextResponse('Forbidden', { status: 403 });
    }

    let fileBuffer: Buffer;
    try {
      fileBuffer = await fs.readFile(targetFile);
    } catch {
      return new NextResponse('File not found', { status: 404 });
    }

    const ext = path.extname(targetFile).toLowerCase();
    const contentType = MIME_MAP[ext] || 'application/octet-stream';

    return new NextResponse(new Uint8Array(fileBuffer), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error('[UPLOADS_ROUTE_ERROR]', error);
    return new NextResponse('Internal server error', { status: 500 });
  }
}
