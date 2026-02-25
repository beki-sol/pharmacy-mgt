import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { auth } from "@/app/lib/auth";

// GET /api/notifications - list notifications for current user
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const unreadOnly = searchParams.get("unreadOnly") === "true";

    const skip = (page - 1) * limit;

    const where: any = { userId: session.user.id };
    if (unreadOnly) where.isRead = false;

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.notification.count({ where }),
    ]);

    return NextResponse.json({
      notifications,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("GET notifications error:", error);
    return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 });
  }
}

// PATCH /api/notifications - mark as read
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { ids, markAll } = body;

    if (markAll) {
      await prisma.notification.updateMany({
        where: { userId: session.user.id, isRead: false },
        data: { isRead: true },
      });
      return NextResponse.json({ success: true });
    }

    if (ids && Array.isArray(ids)) {
      await prisma.notification.updateMany({
        where: { id: { in: ids }, userId: session.user.id },
        data: { isRead: true },
      });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  } catch (error) {
    console.error("PATCH notifications error:", error);
    return NextResponse.json({ error: "Failed to update notifications" }, { status: 500 });
  }
}