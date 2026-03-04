import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    // Find all batches that expire within 30 days (including already expired)
    const expiringBatches = await prisma.drugBatch.findMany({
      where: {
        expiryDate: { lte: thirtyDaysFromNow },
        remaining: { gt: 0 },
      },
      include: {
        drug: { select: { name: true } },
      },
      orderBy: { expiryDate: "asc" },
    });

    return NextResponse.json({ expiring: expiringBatches });
  } catch (error) {
    console.error("GET /inventory/expiring error:", error);
    return NextResponse.json({ error: "Failed to fetch expiring batches" }, { status: 500 });
  }
}