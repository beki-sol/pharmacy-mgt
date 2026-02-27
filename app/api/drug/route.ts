import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/app/lib/prisma";

const drugSchema = z.object({
  name: z.string().min(1, "Name is required"),
  genericName: z.string().optional(),
  brand: z.string().optional(),
  category: z.enum([
    "PRESCRIPTION",
    "OVER_THE_COUNTER",
    "CONTROLLED",
    "HERBAL",
    "SUPPLEMENTS",
    "VACCINE",
    "MEDICAL_SUPPLY",
  ]),
  dosage: z.string().min(1, "Dosage is required"),
  unit: z.string().min(1, "Unit is required"),
  price: z.number().positive("Price must be positive"),
  costPrice: z.number().positive("Cost price must be positive"),
  stock: z.number().int().min(0, "Stock cannot be negative"),
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

// Helper to get a default user ID (first admin) – for logs
async function getDefaultUserId() {
  const user = await prisma.user.findFirst({
    where: { role: "ADMIN" },
    select: { id: true },
  });
  if (!user) throw new Error("No admin user found – cannot create drug");
  return user.id;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const search = searchParams.get("search") || "";
    const category = searchParams.get("category");
    const lowStock = searchParams.get("lowStock");
    const expired = searchParams.get("expired");

    let sortBy = searchParams.get("sortBy") || "name";
    const sortOrder = searchParams.get("sortOrder") === "desc" ? "desc" : "asc";

    const allowedSortFields = ["name", "price", "stock"];
    if (!allowedSortFields.includes(sortBy)) sortBy = "name";

    const skip = (page - 1) * limit;

    let where: any = { isActive: true };

    // 🔎 Search filter
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { genericName: { contains: search, mode: "insensitive" } },
        { brand: { contains: search, mode: "insensitive" } },
        { barcode: { contains: search, mode: "insensitive" } },
      ];
    }

    // 📂 Category filter
    if (category) {
      where.category = category;
    }

    // 🔥 LOW STOCK FILTER (using raw SQL)
    if (lowStock === "true") {
      const lowStockIds = await prisma.$queryRaw<{ id: string }[]>`
        SELECT id
        FROM "Drug"
        WHERE stock <= "minStockLevel"
          AND "isActive" = true
      `;

      if (lowStockIds.length === 0) {
        where.id = { in: [] };
      } else {
        where.id = { in: lowStockIds.map((d) => d.id) };
      }
    }

    // ⏰ Expired filter
    if (expired === "true") {
      where.expiryDate = { lt: new Date() };
    }

    // 🔥 Main Query
    const [drugs, total] = await Promise.all([
      prisma.drug.findMany({
        where,
        include: {
          supplier: {
            select: { name: true, company: true },
          },
          batches: {
            where: { remaining: { gt: 0 } },
            orderBy: { expiryDate: "asc" },
          },
        },
        orderBy: {
          [sortBy]: sortOrder,
        },
        skip,
        take: limit,
      }),
      prisma.drug.count({ where }),
    ]);

    // 🔥 Low Stock Alerts (raw SQL)
    const lowStockDrugs = await prisma.$queryRaw<
      { id: string; name: string; stock: number; minStockLevel: number }[]
    >`
      SELECT id, name, stock, "minStockLevel"
      FROM "Drug"
      WHERE stock <= "minStockLevel"
        AND "isActive" = true
      ORDER BY stock ASC
      LIMIT 5
    `;

    // ⏰ Expired Alerts
    const expiredDrugs = await prisma.drug.findMany({
      where: {
        expiryDate: { lt: new Date() },
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        expiryDate: true,
        batchNumber: true,
      },
      take: 5,
      orderBy: { expiryDate: "asc" },
    });

    return NextResponse.json({
      drugs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
      alerts: {
        lowStock: lowStockDrugs,
        expired: expiredDrugs,
      },
    });
  } catch (error: any) {
    console.error("Get drugs error:", error);
    return NextResponse.json(
      { error: "Failed to fetch drugs" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get a default user ID for logs
    const userId = await getDefaultUserId();

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

    // Check if barcode exists
    if (data.barcode) {
      const existingDrug = await prisma.drug.findUnique({
        where: { barcode: data.barcode },
      });
      if (existingDrug) {
        return NextResponse.json(
          { error: "Barcode already exists" },
          { status: 400 }
        );
      }
    }

    const drug = await prisma.$transaction(async (tx: any) => {
      // Create drug
      const newDrug = await tx.drug.create({
        data: {
          ...data,
          expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
        },
      });

      // Create batch if batch number provided
      if (data.batchNumber && data.stock > 0) {
        await tx.drugBatch.create({
          data: {
            drugId: newDrug.id,
            batchNumber: data.batchNumber,
            expiryDate: data.expiryDate
              ? new Date(data.expiryDate)
              : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
            quantity: data.stock,
            remaining: data.stock,
            costPrice: data.costPrice,
          },
        });
      }

      // Create inventory log (using default userId)
      await tx.inventoryLog.create({
        data: {
          drugId: newDrug.id,
          type: "PURCHASE",
          quantity: data.stock,
          previousStock: 0,
          newStock: data.stock,
          // referenceType: "NEW_DRUG",  // if your schema has this field; otherwise remove
          notes: "Initial stock",
          userId, // default user
        },
      });

      // Audit log is omitted because it requires request headers and user details

      return newDrug;
    });

    return NextResponse.json(drug, { status: 201 });
  } catch (error: any) {
    console.error("Create drug error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error.message || "Failed to create drug" },
      { status: 500 }
    );
  }
}