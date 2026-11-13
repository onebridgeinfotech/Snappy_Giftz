import { NextResponse } from 'next/server';
import { can, handleApiError, requireCms } from '@/lib/cms/api';

/** What the signed-in person may do in the CMS, so the UI can show or hide buttons. */
export async function GET(req: Request) {
  try {
    const user = await requireCms(req);
    return NextResponse.json({
      success: true,
      data: { role: user.role, name: user.name, canPublish: can(user, 'content:publish'), canDelete: can(user, 'content:delete'), canManageSettings: can(user, 'cms:settings') },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
