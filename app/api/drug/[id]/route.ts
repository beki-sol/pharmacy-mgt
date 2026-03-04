import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { z } from "zod";

const drugUpdateSchema = z.object({
  name: z.string().min(1, "Name is required").optional(),
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
  ]).optional(),
  dosage: z.string().min(1, "Dosage is required").optional(),
  unit: z.string().min(1, "Unit is required").optional(),
  price: z.number().positive("Price must be positive").optional(),
  costPrice: z.number().positive("Cost price must be positive").optional(),
  stock: z.number().int().min(0, "Stock cannot be negative").optional(),
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params; // ✅ Await the promise

    const drug = await prisma.drug.findUnique({
      where: { id },
      include: {
        supplier: {
          select: { name: true, company: true, phone: true, email: true },
        },
        batches: {
          where: { remaining: { gt: 0 } },
          orderBy: { expiryDate: "asc" },
        },
      },
    });

    if (!drug) {
      return NextResponse.json({ error: "Drug not found" }, { status: 404 });
    }

    return NextResponse.json(drug);
  } catch (error: any) {
    console.error("Get drug error:", error);
    return NextResponse.json(
      { error: "Failed to fetch drug" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params; // ✅ Await the promise
    const body = await request.json();

    // Parse and validate input
    const data = drugUpdateSchema.parse({
      ...body,
      price: body.price !== undefined ? parseFloat(body.price) : undefined,
      costPrice: body.costPrice !== undefined ? parseFloat(body.costPrice) : undefined,
      stock: body.stock !== undefined ? parseInt(body.stock) : undefined,
      minStockLevel: body.minStockLevel !== undefined ? parseInt(body.minStockLevel) : undefined,
      maxStockLevel: body.maxStockLevel !== undefined ? parseInt(body.maxStockLevel) : undefined,
      reorderPoint: body.reorderPoint !== undefined ? parseInt(body.reorderPoint) : undefined,
    });

    // Check if drug exists
    const existingDrug = await prisma.drug.findUnique({
      where: { id },
    });

    if (!existingDrug) {
      return NextResponse.json({ error: "Drug not found" }, { status: 404 });
    }

    // If updating barcode, ensure uniqueness
    if (data.barcode && data.barcode !== existingDrug.barcode) {
      const barcodeExists = await prisma.drug.findUnique({
        where: { barcode: data.barcode },
      });
      if (barcodeExists) {
        return NextResponse.json(
          { error: "Barcode already exists" },
          { status: 400 }
        );
      }
    }

    // Update drug
    const updatedDrug = await prisma.drug.update({
      where: { id },
      data: {
        ...data,
        expiryDate: data.expiryDate ? new Date(data.expiryDate) : undefined,
      },
    });

    return NextResponse.json(updatedDrug);
  } catch (error: any) {
    console.error("Update drug error:", error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: error.message || "Failed to update drug" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params; // ✅ Await the promise

    // Check if drug exists
    const drug = await prisma.drug.findUnique({
      where: { id },
      include: {
        saleItems: { take: 1 },
        purchaseItems: { take: 1 },
        prescriptions: { take: 1 },
      },
    });

    if (!drug) {
      return NextResponse.json({ error: "Drug not found" }, { status: 404 });
    }

    // Check if drug has any transactions
    if (drug.saleItems.length > 0 || drug.purchaseItems.length > 0 || drug.prescriptions.length > 0) {
      // Soft delete instead
      await prisma.drug.update({
        where: { id },
        data: { isActive: false },
      });

      return NextResponse.json({
        message: "Drug has been deactivated because it has associated transactions",
      });
    }

    // Hard delete if no transactions
    await prisma.$transaction(async (tx: any) => {
      // Delete related batches
      await tx.drugBatch.deleteMany({ where: { drugId: id } });
      // Delete drug
      await tx.drug.delete({ where: { id } });
    });

    return NextResponse.json({ message: "Drug deleted successfully" });
  } catch (error: any) {
    console.error("Delete drug error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete drug" },
      { status: 500 }
    );
  }
}