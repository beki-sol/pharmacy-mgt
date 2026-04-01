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
  const data = drugUpdateSchema.parse({
    ...body,
    price: body.price !== undefined ? parseFloat(body.price) : undefined,
    costPrice: body.costPrice !== undefined ? parseFloat(body.costPrice) : undefined,
    stock: body.stock !== undefined ? parseInt(body.stock) : undefined,
    minStockLevel: body.minStockLevel !== undefined ? parseInt(body.minStockLevel) : undefined,
    maxStockLevel: body.maxStockLevel !== undefined ? parseInt(body.maxStockLevel) : undefined,
    reorderPoint: body.reorderPoint !== undefined ? parseInt(body.reorderPoint) : undefined,
  });

  const existing = await prisma.drug.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (data.barcode && data.barcode !== existing.barcode) {
    const duplicate = await prisma.drug.findUnique({ where: { barcode: data.barcode } });
    if (duplicate) return NextResponse.json({ error: "Barcode already exists" }, { status: 400 });
  }

  const updated = await prisma.drug.update({
    where: { id },
    data: {
      ...data,
      expiryDate: data.expiryDate ? new Date(data.expiryDate) : undefined,
    },
  });
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