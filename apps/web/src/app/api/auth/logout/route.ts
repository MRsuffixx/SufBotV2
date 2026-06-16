import { NextResponse, type NextRequest } from 'next/server';
import { destroyCurrentSession, getCurrentUser } from '../../../../lib/session';
import { auditLogRepository } from '@bot/database';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUser();
  await destroyCurrentSession();
  if (user) {
    await auditLogRepository
      .record({
        actorId: user.id,
        action: 'auth.logout',
        description: `User ${user.username} (${user.id}) logged out`,
        source: 'web',
      })
      .catch(() => undefined);
  }
  return NextResponse.redirect(new URL('/', req.url));
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  return POST(req);
}
