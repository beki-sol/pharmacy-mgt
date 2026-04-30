// app/api/drug/bulk-import/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { z } from "zod";

const importRowSchema = z.object({
  drugName: z.string().min(1),
  genericName: z.string().optional(),
  category: z.string().optional(),
  brand: z.string().optional(),
  dosage: z.string().optional(),
  unit: z.string().optional(),
  price: z.number().positive(),
  costPrice: z.number().positive(),
  barcode: z.string().optional(),
  batchNumber: z.string().optional(),
  expiryDate: z.string().optional(),
  quantityTransferred: z.number().int().optional(),
  fromStore: z.string().optional(),
  toStore: z.string().optional(),
  transferStatus: z.string().optional(),
  date: z.string().optional(),
});

type ImportRow = z.infer<typeof importRowSchema>;

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const body = await req.json();
  const rows = body.rows;
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: "No data provided" }, { status: 400 });
  }

  // Validate rows
  const validatedRows: ImportRow[] = [];
  const validationErrors: string[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    try {
      const processed = {
        ...row,
        price: parseFloat(row.price),
        costPrice: parseFloat(row.costPrice),
        quantityTransferred: row.quantityTransferred ? parseInt(row.quantityTransferred) : 0,
      };
      const parsed = importRowSchema.parse(processed);
      validatedRows.push(parsed);
    } catch (err: any) {
      validationErrors.push(`Row ${i + 1}: ${err.message}`);
    }
  }
  if (validationErrors.length > 0) {
    return NextResponse.json({ error: "Validation failed", details: validationErrors }, { status: 400 });
  }

  const results: any[] = [];
  const errors: string[] = [];

  // Process each row
  for (let idx = 0; idx < validatedRows.length; idx++) {
    const row = validatedRows[idx];
    try {
      let categoryId: string | null = null;
      if (row.category) {
        let category = await prisma.category.findFirst({
          where: { name: { equals: row.category, mode: "insensitive" } },
        });
        if (!category) {
          // Create category – assuming only `name` is required; adjust if your model has more
          category = await prisma.category.create({
            data: { name: row.category },
          });
        }
        categoryId = category.id;
      }

      // Find or create drug
      let drug = null;
      if (row.barcode) {
        drug = await prisma.drug.findUnique({ where: { barcode: row.barcode } });
      }
      if (!drug) {
        drug = await prisma.drug.findFirst({
          where: {
            name: { equals: row.drugName, mode: "insensitive" },
            ...(row.genericName ? { genericName: { equals: row.genericName, mode: "insensitive" } } : {}),
            ...(row.brand ? { brand: { equals: row.brand, mode: "insensitive" } } : {}),
          },
        });
      }

      let isNewDrug = false;
      if (!drug) {
        drug = await prisma.drug.create({
          data: {
            name: row.drugName,
            genericName: row.genericName || null,
            brand: row.brand || null,
            categoryId,
            dosage: row.dosage || "",
            unit: row.unit || "",
            price: row.price,
            costPrice: row.costPrice,
            stock: row.quantityTransferred || 0,
            minStockLevel: 10,
            maxStockLevel: 100,
            reorderPoint: 20,
            barcode: row.barcode || null,
            isActive: true,
          },
        });
        isNewDrug = true;
      }

      let stockAdded = 0;
      // Create or update batch
      if (row.batchNumber && row.quantityTransferred && row.quantityTransferred > 0) {
        const existingBatch = await prisma.drugBatch.findFirst({
          where: { drugId: drug.id, batchNumber: row.batchNumber },
        });
        if (!existingBatch) {
          await prisma.drugBatch.create({
            data: {
              drugId: drug.id,
              batchNumber: row.batchNumber,
              expiryDate: row.expiryDate ? new Date(row.expiryDate) : new Date(Date.now() + 365 * 86400000),
              quantity: row.quantityTransferred,
              remaining: row.quantityTransferred,
              costPrice: row.costPrice,
            },
          });
          stockAdded = row.quantityTransferred;
        } else {
          await prisma.drugBatch.update({
            where: { id: existingBatch.id },
            data: {
              remaining: { increment: row.quantityTransferred },
              quantity: { increment: row.quantityTransferred },
            },
          });
          stockAdded = row.quantityTransferred;
        }
      }

      // Update drug total stock if quantity added
      if (stockAdded > 0) {
        const previousStock = drug.stock;
        const newStock = previousStock + stockAdded;
        await prisma.drug.update({
          where: { id: drug.id },
          data: { stock: newStock },
        });

        // Create inventory log (PURCHASE type)
        await prisma.inventoryLog.create({
          data: {
            drugId: drug.id,
            type: "PURCHASE",
            quantity: stockAdded,
            previousStock,
            newStock,
            batchNumber: row.batchNumber || null,
            notes: `Bulk import from CSV (batch ${row.batchNumber || "N/A"})`,
            userId,
          },
        });
      } else if (isNewDrug && (row.quantityTransferred === 0 || !row.quantityTransferred)) {
        // Drug created with zero stock – optionally log a zero stock creation
        await prisma.inventoryLog.create({
          data: {
            drugId: drug.id,
            type: "PURCHASE",
            quantity: 0,
            previousStock: 0,
            newStock: 0,
            notes: "Drug created via CSV import with zero stock",
            userId,
          },
        });
      }

      results.push({ drugName: row.drugName, batch: row.batchNumber, status: "success" });
    } catch (err: any) {
      const errorMsg = `Row ${idx + 1} (${row.drugName}): ${err.message}`;
      errors.push(errorMsg);
      console.error(errorMsg, err);
    }
  }

  return NextResponse.json({ results, errors, total: results.length });
}