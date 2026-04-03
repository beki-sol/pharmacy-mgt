import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";

const drugUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  genericName: z.string().optional(),
  brand: z.string().optional(),
  categoryId: z.string().min(1).optional(),
  dosage: z.string().min(1).optional(),
  unit: z.string().min(1).optional(),
  price: z.number().positive().optional(),
  costPrice: z.number().positive().optional(),
  stock: z.number().int().min(0).optional(),
  minStockLevel: z.number().int().min(0).optional(),
  maxStockLevel: z.number().int().min(0).optional(),
  reorderPoint: z.number().int().min(0).optional(),
  expiryDate: z.string().optional(),
  batchNumber: z.string().optional(),
  supplierId: z.string().optional(),
  barcode: z.string().optional(),
  description: z.string().optional(),
  sideEffects: z.string().optional(),
  storageCondition: z.string().optional(),
  isActive: z.boolean().optional(),
  batches: z.array(z.object({
    id: z.string(),
    expiryDate: z.string().datetime(),
  })).optional(),
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const drug = await prisma.drug.findUnique({
    where: { id },
    include: {
      supplier: { select: { id: true, name: true, company: true, phone: true, email: true } },
      category: true,
      batches: { where: { remaining: { gt: 0 } }, orderBy: { expiryDate: "asc" } },
    },
  });
  if (!drug) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(drug);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();

  // Separate batches from the rest of the data
  const { batches: batchUpdates, ...drugData } = body;

  // Validate the drug scalar fields
  const parsed = drugUpdateSchema.parse({
    ...drugData,
    price: drugData.price !== undefined ? parseFloat(drugData.price) : undefined,
    costPrice: drugData.costPrice !== undefined ? parseFloat(drugData.costPrice) : undefined,
    stock: drugData.stock !== undefined ? parseInt(drugData.stock) : undefined,
    minStockLevel: drugData.minStockLevel !== undefined ? parseInt(drugData.minStockLevel) : undefined,
    maxStockLevel: drugData.maxStockLevel !== undefined ? parseInt(drugData.maxStockLevel) : undefined,
    reorderPoint: drugData.reorderPoint !== undefined ? parseInt(drugData.reorderPoint) : undefined,
  });

  // Build update object by omitting undefined values
  const updateData: any = {};
  for (const key of Object.keys(parsed)) {
    const value = (parsed as any)[key];
    if (value !== undefined) {
      updateData[key] = value;
    }
  }

  // Convert expiryDate from string to Date if present
  if (updateData.expiryDate) {
    updateData.expiryDate = new Date(updateData.expiryDate);
  }

  const existing = await prisma.drug.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (updateData.barcode && updateData.barcode !== existing.barcode) {
    const duplicate = await prisma.drug.findUnique({ where: { barcode: updateData.barcode } });
    if (duplicate) return NextResponse.json({ error: "Barcode already exists" }, { status: 400 });
  }

  // Update the drug's scalar fields
  const updated = await prisma.drug.update({
    where: { id },
    data: updateData,
  });

  // Update batch expiry dates if provided
  if (batchUpdates && Array.isArray(batchUpdates)) {
    for (const batchUpdate of batchUpdates) {
      await prisma.drugBatch.update({
        where: { id: batchUpdate.id },
        data: { expiryDate: new Date(batchUpdate.expiryDate) },
      });
    }
  }

  return NextResponse.json(updated);
}
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const drug = await prisma.drug.findUnique({
    where: { id },
    include: { saleItems: { take: 1 }, purchaseItems: { take: 1 }, prescriptions: { take: 1 } },
  });
  if (!drug) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (drug.saleItems.length || drug.purchaseItems.length || drug.prescriptions.length) {
    await prisma.drug.update({ where: { id }, data: { isActive: false } });
    return NextResponse.json({ message: "Drug deactivated (has transactions)" });
  }

  await prisma.$transaction(async (tx: any) => {
    await tx.drugBatch.deleteMany({ where: { drugId: id } });
    await tx.drug.delete({ where: { id } });
  });
  return NextResponse.json({ message: "Deleted" });
}