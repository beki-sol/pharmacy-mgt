import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const batches = await prisma.drugBatch.findMany({
      where: {
        drugId: id,
        remaining: { gt: 0 },
      },
      orderBy: { expiryDate: "asc" },
    });

    // Convert Decimal costPrice to number (optional, frontend may not need it)
    const formatted = batches.map((batch) => ({
      ...batch,
      costPrice: batch.costPrice ? Number(batch.costPrice) : 0,
    }));

    return NextResponse.json({ batches: formatted });
  } catch (error) {
    console.error("Error fetching batches:", error);
    return NextResponse.json(
      { error: "Failed to fetch batches" },
      { status: 500 }
    );
  }
}