import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { z } from "zod";

const createBatchSchema = z.object({
  batchNumber: z.string().min(1),
  expiryDate: z.string().datetime(),
  quantity: z.number().int().positive(),
  costPrice: z.number().positive(),
});

// GET - list batches for a drug (already existing)
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
    const formatted = batches.map((batch) => ({
      ...batch,
      costPrice: batch.costPrice ? Number(batch.costPrice) : 0,
    }));
    return NextResponse.json({ batches: formatted });
  } catch (error) {
    console.error("Error fetching batches:", error);
    return NextResponse.json({ error: "Failed to fetch batches" }, { status: 500 });
  }
}

// POST - add a new batch to a drug (requires authentication)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const data = createBatchSchema.parse(body);

  const drug = await prisma.drug.findUnique({ where: { id } });
  if (!drug) {
    return NextResponse.json({ error: "Drug not found" }, { status: 404 });
  }

  const batch = await prisma.$transaction(async (tx) => {
    const newBatch = await tx.drugBatch.create({
      data: {
        drugId: id,
        batchNumber: data.batchNumber,
        expiryDate: new Date(data.expiryDate),
        quantity: data.quantity,
        remaining: data.quantity,
        costPrice: data.costPrice,
      },
    });
    await tx.drug.update({
      where: { id },
      data: { stock: { increment: data.quantity } },
    });
    await tx.inventoryLog.create({
      data: {
        drugId: id,
        type: "PURCHASE",
        quantity: data.quantity,
        previousStock: drug.stock,
        newStock: drug.stock + data.quantity,
        notes: `Added batch ${data.batchNumber}`,
        userId: session.user.id,
      },
    });
    return newBatch;
  });

  return NextResponse.json(batch, { status: 201 });
}