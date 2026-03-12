import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { getSessionId, setSessionCookie } from '@/app/lib/sesssion';
import { randomUUID } from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const sessionId = await getSessionId();
    const { draftId, data } = await request.json();

    const finalDraftId = draftId || randomUUID();

    const draft = await prisma.draft.upsert({
      where: { id: finalDraftId },
      update: { data, sessionId },
      create: { id: finalDraftId, sessionId, data },
    });

    const response = NextResponse.json({ success: true, draftId: draft.id });
    if (!request.cookies.get('session_id')) {
      setSessionCookie(response, sessionId);
    }
    return response;
  } catch (error) {
    console.error('Save draft error:', error);
    return NextResponse.json({ error: 'Failed to save draft' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const sessionId = await getSessionId();
    const drafts = await prisma.draft.findMany({
      where: { sessionId },
      orderBy: { updatedAt: 'desc' },
    });

    const response = NextResponse.json({ drafts });
    if (!request.cookies.get('session_id')) {
      setSessionCookie(response, sessionId);
    }
    return response;
  } catch (error) {
    console.error('List drafts error:', error);
    return NextResponse.json({ error: 'Failed to list drafts' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const sessionId = await getSessionId();
    const { searchParams } = new URL(request.url);
    const draftId = searchParams.get('draftId');

    if (!draftId) {
      return NextResponse.json({ error: 'draftId required' }, { status: 400 });
    }

    await prisma.draft.delete({
      where: { id: draftId, sessionId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete draft error:', error);
    return NextResponse.json({ error: 'Failed to delete draft' }, { status: 500 });
  }
}