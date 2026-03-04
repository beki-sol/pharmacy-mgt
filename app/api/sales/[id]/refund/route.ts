import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { z } from "zod";

// Helper to get default user ID (first admin) – for development without auth
async function getDefaultUserId() {
  const user = await prisma.user.findFirst({
    where: { role: "ADMIN" },
    select: { id: true },
  });
  if (!user) throw new Error("No admin user found – cannot process refund");
  return user.id;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userId = await getDefaultUserId();
    const { id } = await params;
    const { reason } = await request.json(); // optional reason for refund

    // Fetch the sale with its items and batches
    const sale = await prisma.sale.findUnique({
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
      return NextResponse.json({ error: "Sale not found" }, { status: 404 });
    }

    // Only allow refund of completed sales
    if (sale.status !== "COMPLETED") {
      return NextResponse.json(
        { error: "Only completed sales can be refunded" },
        { status: 400 }
      );
    }

    // Perform refund in a transaction
    await prisma.$transaction(async (tx) => {
      // 1. Restore stock and batch remaining for each sale item
      for (const item of sale.saleItems) {
        // Restore drug stock
        await tx.drug.update({
          where: { id: item.drugId },
          data: { stock: { increment: item.quantity } },
        });

        // If a batch was used, restore its remaining quantity
        if (item.batchId) {
          await tx.drugBatch.update({
            where: { id: item.batchId },
            data: { remaining: { increment: item.quantity } },
          });
        }

        // Create inventory log for the return
        await tx.inventoryLog.create({
          data: {
            drugId: item.drugId,
            type: "RETURN",
            quantity: item.quantity, // positive because it's added back
            previousStock: item.drug.stock, // old stock before refund
            newStock: item.drug.stock + item.quantity,
            saleId: sale.id,
            //batchId: item.batchId,
            batchNumber: item.batchNumber,
            notes: `Refund for sale ${sale.invoiceNumber}` + (reason ? `: ${reason}` : ""),
            userId,
          },
        });
      }

      // 2. Create a refund payment record (positive amount, but marked as refund)
      await tx.payment.create({
        data: {
          saleId: sale.id,
          amount: sale.netAmount,
          method: "REFUND",
          status: "COMPLETED",
          notes: reason || "Refund processed",
          paidAt: new Date(),
        },
      });

      // 3. Update sale status to REFUNDED
      await tx.sale.update({
        where: { id: sale.id },
        data: { status: "REFUNDED" },
      });

      // 4. Optionally create an audit log (if you have an AuditLog model)
      // await tx.auditLog.create({ ... });
    });

    return NextResponse.json({ success: true, message: "Sale refunded successfully" });
  } catch (error) {
    console.error("Refund error:", error);
    return NextResponse.json({ error: "Failed to process refund" }, { status: 500 });
  }
}