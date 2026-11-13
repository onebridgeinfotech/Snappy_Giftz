import { NextResponse } from 'next/server';
import { audit, handleApiError, requireCms, str } from '@/lib/cms/api';
import { duplicatePost } from '@/lib/cms/post-admin.service';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireCms(req);
    const { id } = await params;
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const post = await duplicatePost(id, user, { asTemplate: body.asTemplate === true, templateName: str(body.templateName, 120) ?? undefined });
    await audit(user.id, body.asTemplate ? 'CMS_POST_SAVED_AS_TEMPLATE' : 'CMS_POST_DUPLICATED', `BlogPost:${post.id}`, { sourceId: id });
    return NextResponse.json({ success: true, data: post }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
