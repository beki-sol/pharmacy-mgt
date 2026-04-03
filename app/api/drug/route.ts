// app/api/drug/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/app/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";

const drugSchema = z.object({
  name: z.string().min(1),
  genericName: z.string().optional(),
  brand: z.string().optional(),
  categoryId: z.string().min(1),
  dosage: z.string().min(1),
  unit: z.string().min(1),
  price: z.number().positive(),
  costPrice: z.number().positive(),
  stock: z.number().int().min(0),
  minStockLevel: z.number().int().min(0),
  maxStockLevel: z.number().int().min(0),
  reorderPoint: z.number().int().min(0),
  expiryDate: z.string().optional(),
  batchNumber: z.string().optional(),
  supplierId: z.string().optional(),
  barcode: z.string().optional(),
  description: z.string().optional(),
  sideEffects: z.string().optional(),
  storageCondition: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "10");
  const search = searchParams.get("search") || "";
  const categoryId = searchParams.get("categoryId");
  const lowStock = searchParams.get("lowStock");
  const expired = searchParams.get("expired");

  let sortBy = searchParams.get("sortBy") || "name";
  const sortOrder = searchParams.get("sortOrder") === "desc" ? "desc" : "asc";
  const allowedSortFields = ["name", "price", "stock"];
  if (!allowedSortFields.includes(sortBy)) sortBy = "name";

  const skip = (page - 1) * limit;
  let where: any = { isActive: true };

  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { genericName: { contains: search, mode: "insensitive" } },
      { brand: { contains: search, mode: "insensitive" } },
      { barcode: { contains: search, mode: "insensitive" } },
    ];
  }

  if (categoryId) where.categoryId = categoryId;

  if (lowStock === "true") {
    const lowStockIds = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM "Drug"
      WHERE stock <= "minStockLevel" AND "isActive" = true
    `;
    where.id = lowStockIds.length ? { in: lowStockIds.map(d => d.id) } : { in: [] };
  }

  if (expired === "true") where.expiryDate = { lt: new Date() };

  const [drugs, total] = await Promise.all([
    prisma.drug.findMany({
      where,
      include: {
        supplier: { select: { name: true, company: true } },
        batches: { where: { remaining: { gt: 0 } }, orderBy: { expiryDate: "asc" } },
        category: true,
      },
      orderBy: { [sortBy]: sortOrder },
      skip,
      take: limit,
    }),
    prisma.drug.count({ where }),
  ]);

  // Transform drugs to include a plain category string
  const transformedDrugs = drugs.map(drug => ({
    ...drug,
    category: drug.category?.name || null,   // replaces the category object with its name
    categoryId: drug.categoryId,             // keep the ID if needed
  }));

  const lowStockDrugs = await prisma.$queryRaw<{ id: string; name: string; stock: number; minStockLevel: number }[]>`
    SELECT id, name, stock, "minStockLevel"
    FROM "Drug"
    WHERE stock <= "minStockLevel" AND "isActive" = true
    ORDER BY stock ASC
    LIMIT 5
  `;

  const expiredDrugs = await prisma.drug.findMany({
    where: { expiryDate: { lt: new Date() }, isActive: true },
    select: { id: true, name: true, expiryDate: true, batchNumber: true },
    take: 5,
    orderBy: { expiryDate: "asc" },
  });

  return NextResponse.json({
    drugs: transformedDrugs,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    alerts: { lowStock: lowStockDrugs, expired: expiredDrugs },
  });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const data = drugSchema.parse({
    ...body,
    price: parseFloat(body.price),
    costPrice: parseFloat(body.costPrice),
    stock: parseInt(body.stock),
    minStockLevel: parseInt(body.minStockLevel),
    maxStockLevel: parseInt(body.maxStockLevel),
    reorderPoint: parseInt(body.reorderPoint),
  });

  if (data.barcode) {
    const existing = await prisma.drug.findUnique({ where: { barcode: data.barcode } });
    if (existing) return NextResponse.json({ error: "Barcode already exists" }, { status: 400 });
  }

  const drug = await prisma.$transaction(async (tx: any) => {
    const newDrug = await tx.drug.create({
      data: {
        ...data,
        expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
      },
    });

    if (data.batchNumber && data.stock > 0) {
      await tx.drugBatch.create({
        data: {
          drugId: newDrug.id,
          batchNumber: data.batchNumber,
          expiryDate: data.expiryDate ? new Date(data.expiryDate) : new Date(Date.now() + 365 * 86400000),
          quantity: data.stock,
          remaining: data.stock,
          costPrice: data.costPrice,
        },
      });
    }

    await tx.inventoryLog.create({
      data: {
        drugId: newDrug.id,
        type: "PURCHASE",
        quantity: data.stock,
        previousStock: 0,
        newStock: data.stock,
        notes: "Initial stock",
        userId: session.user.id,
      },
    });

    return newDrug;
  });

  return NextResponse.json(drug, { status: 201 });
}