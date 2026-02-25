import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/lib/auth";

import { prisma } from "@/app/lib/prisma";
import { z } from "zod";

const schema = z.object({
  telegramChatId: z.string().optional(),
});

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { telegramChatId: true },
  });
  return NextResponse.json({ telegramChatId: user?.telegramChatId });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { telegramChatId } = schema.parse(body);

  await prisma.user.update({
    where: { email: session.user.email },
    data: { telegramChatId },
  });

  return NextResponse.json({ success: true });
}