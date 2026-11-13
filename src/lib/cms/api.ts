import { NextResponse } from 'next/server';
import { Prisma, Role, type User } from '@prisma/client';
import { AuthError, requireRole } from '@/lib/auth/rbac';
import { prisma } from '@/lib/prisma';

/**
 * CMS permission model (built on the existing roles):
 *   ADMIN — everything: publish, schedule, delete, SEO settings, redirects, authors.
 *   STAFF — editor: create and edit drafts, upload media, moderate comments, use AI assistant.
 */
export type CmsPermission = 'content:edit' | 'content:publish' | 'content:delete' | 'cms:settings';

/** Admin-controlled switch (Content & SEO > Robots, menu & footer > Permissions). Refreshed on every CMS request. */
let staffCanPublish = false;
let permsLoadedAt = 0;

export function canStaffPublish() {
  return staffCanPublish;
}

export function can(user: Pick<User, 'role'>, permission: CmsPermission): boolean {
  if (user.role === Role.ADMIN || (user.role as string) === 'SUPER_ADMIN') return true;
  if (user.role === Role.STAFF) {
    if (permission === 'content:edit') return true;
    if (permission === 'content:publish' || permission === 'content:delete') return staffCanPublish;
  }
  return false;
}

async function refreshPermissions() {
  if (Date.now() - permsLoadedAt < 15_000) return;
  permsLoadedAt = Date.now();
  try {
    const row = await prisma.cmsSetting.findUnique({ where: { key: 'permissions' } });
    staffCanPublish = Boolean((row?.value as { staffCanPublish?: boolean } | null)?.staffCanPublish);
  } catch {
    /* keep last known value */
  }
}

export function invalidatePermissions() {
  permsLoadedAt = 0;
}

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = 'BAD_REQUEST'
  ) {
    super(message);
  }
}

export async function requireCms(req: Request, permission: CmsPermission = 'content:edit'): Promise<User> {
  const user = await requireRole([Role.ADMIN, Role.STAFF], req);
  await refreshPermissions();
  if (!can(user, permission)) {
    throw new HttpError(403, 'Your role cannot perform this action. Ask an admin.', 'FORBIDDEN');
  }
  return user;
}

export async function readJson<T = Record<string, unknown>>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new HttpError(400, 'Invalid JSON request body');
  }
}

export function handleApiError(error: unknown) {
  if (error instanceof AuthError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode });
  }
  if (error instanceof HttpError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') return NextResponse.json({ error: 'That slug or value is already in use.', code: 'CONFLICT' }, { status: 409 });
    if (error.code === 'P2025') return NextResponse.json({ error: 'Not found', code: 'NOT_FOUND' }, { status: 404 });
  }
  console.error('[CMS_API]', error);
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
}

export function audit(userId: string, action: string, resource: string, details?: Record<string, unknown>) {
  return prisma.auditLog
    .create({ data: { userId, action, resource, details: (details as Prisma.InputJsonValue) ?? undefined } })
    .catch(() => undefined);
}

export function str(value: unknown, max = 500): string | null {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  return v ? v.slice(0, max) : null;
}

export function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}
