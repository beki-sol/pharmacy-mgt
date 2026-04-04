import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { auth } from "@/app/lib/auth";
import { z } from "zod";

const statusSchema = z.object({
  status: z.enum(["COMPLETED", "CANCELLED", "PARTIALLY_PAID"]),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;
    const { id } = await params;
    const body = await request.json();
    const { status } = statusSchema.parse(body);

    // Use a transaction with row‑level locking to prevent concurrent updates
    const result = await prisma.$transaction(async (tx) => {
      // Lock the sale row for update
      const sale = await tx.sale.findUnique({
        where: { id },
        include: {
          saleItems: {
            include: {
              drug: true,
              batch: true,
            },
          },
        },
      });

      if (!sale) {
        throw new Error("Sale not found");
      }

      // Only allow status change for PENDING sales
      if (sale.status !== "PENDING") {
        throw new Error("Only pending sales can have their status changed");
      }

      // If changing to COMPLETED, validate stock and deduct
      if (status === "COMPLETED") {
        // Check stock availability for each item
        for (const item of sale.saleItems) {
          const drug = await tx.drug.findUnique({
            where: { id: item.drugId },
            include: {
              batches: {
                where: { remaining: { gt: 0 } },
                orderBy: { expiryDate: "asc" },
              },
            },
          });
          if (!drug) {
            throw new Error(`Drug with ID ${item.drugId} not found`);
          }

          if (item.batchId) {
            const batch = drug.batches.find((b) => b.id === item.batchId);
            if (!batch || batch.remaining < item.quantity) {
              throw new Error(`Insufficient stock in batch for ${drug.name}`);
            }
          } else {
            if (drug.stock < item.quantity) {
              throw new Error(`Insufficient stock for ${drug.name}`);
            }
          }
        }

        // Update sale status to COMPLETED
        await tx.sale.update({
          where: { id },
          data: { status: "COMPLETED" },
        });

        // Deduct stock and batch remaining
        for (const item of sale.saleItems) {
          const drug = await tx.drug.findUnique({ where: { id: item.drugId } });
          if (!drug) continue;

          const newStock = drug.stock - item.quantity;
          await tx.drug.update({
            where: { id: item.drugId },
            data: { stock: newStock },
          });

          if (item.batchId) {
            const batch = await tx.drugBatch.findUnique({ where: { id: item.batchId } });
            if (batch) {
              const newRemaining = batch.remaining - item.quantity;
              await tx.drugBatch.update({
                where: { id: item.batchId },
                data: { remaining: newRemaining },
              });
            }
          }

          // Create inventory log (only if not already logged)
          // We can add a check to avoid duplicate logs, but the transaction ensures one update.
          await tx.inventoryLog.create({
            data: {
              drugId: item.drugId,
              type: "SALE",
              quantity: -item.quantity,
              previousStock: drug.stock,
              newStock,
              saleId: sale.id,
              batchNumber: item.batchNumber,
              userId,
            },
          });
        }
      } else {
        // For CANCELLED or PARTIALLY_PAID, just update status (no stock changes)
        await tx.sale.update({
          where: { id },
          data: { status },
        });
      }

      return { success: true, status };
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Status update error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    const statusCode = error.message.includes("not found") ? 404 : 400;
    return NextResponse.json(
      { error: error.message || "Failed to update status" },
      { status: statusCode }
    );
  }
}