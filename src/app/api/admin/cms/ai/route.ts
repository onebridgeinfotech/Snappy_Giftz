import { NextResponse } from 'next/server';
import { enforceRateLimit } from '@/lib/security/rate-limit';
import { audit, handleApiError, HttpError, readJson, requireCms } from '@/lib/cms/api';
import { AI_ACTIONS, isAiConfigured, runAiAction, type AiAction } from '@/lib/cms/ai-writer';

export async function GET(req: Request) {
  try {
    await requireCms(req);
    return NextResponse.json({ success: true, configured: isAiConfigured(), actions: AI_ACTIONS });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireCms(req);
    const limit = await enforceRateLimit('CMS_AI', user.id, { limit: 20, windowSeconds: 60 });
    if (!limit.allowed) throw new HttpError(429, 'Too many AI requests. Wait a minute and retry.', 'RATE_LIMITED');
    const body = await readJson<Record<string, any>>(req);
    if (!AI_ACTIONS.includes(body.action)) throw new HttpError(400, 'Unknown AI action');
    const out = await runAiAction({
      action: body.action as AiAction,
      text: typeof body.text === 'string' ? body.text : undefined,
      title: typeof body.title === 'string' ? body.title.slice(0, 200) : undefined,
      topic: typeof body.topic === 'string' ? body.topic.slice(0, 300) : undefined,
      focusKeyword: typeof body.focusKeyword === 'string' ? body.focusKeyword.slice(0, 80) : undefined,
      tone: typeof body.tone === 'string' ? body.tone.slice(0, 60) : undefined,
      length: ['short', 'medium', 'long'].includes(body.length) ? body.length : undefined,
    });
    await audit(user.id, 'CMS_AI_USED', 'CMS:ai', { action: body.action, source: out.source });
    return NextResponse.json({ success: true, ...out });
  } catch (error) {
    return handleApiError(error);
  }
}
