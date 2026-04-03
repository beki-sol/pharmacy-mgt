import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { auth } from '@/app/lib/auth';
import { randomUUID } from 'crypto';

// Helper to get the authenticated user ID
async function getUserId(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return null;
  }
  return session.user.id;
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { draftId, data } = await request.json();

    const finalDraftId = draftId || randomUUID();

    const draft = await prisma.draft.upsert({
      where: { id: finalDraftId },
      update: { data, userId },
      create: { id: finalDraftId, userId, data },
    });

    return NextResponse.json({ success: true, draftId: draft.id });
  } catch (error) {
    console.error('Save draft error:', error);
    return NextResponse.json({ error: 'Failed to save draft' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const drafts = await prisma.draft.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });

    return NextResponse.json({ drafts });
  } catch (error) {
    console.error('List drafts error:', error);
    return NextResponse.json({ error: 'Failed to list drafts' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { searchParams } = new URL(request.url);
    const draftId = searchParams.get('draftId');

    if (!draftId) {
      return NextResponse.json({ error: 'draftId required' }, { status: 400 });
    }

    await prisma.draft.delete({
      where: { id: draftId, userId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete draft error:', error);
    return NextResponse.json({ error: 'Failed to delete draft' }, { status: 500 });
  }
}