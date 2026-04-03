import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { auth } from "@/app/lib/auth";

export const POST = async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;
    const { id } = await params;
    const { reason } = await request.json();

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
    if (sale.status !== "COMPLETED") {
      return NextResponse.json(
        { error: "Only completed sales can be refunded" },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx) => {
      for (const item of sale.saleItems) {
        // Restore drug stock
        await tx.drug.update({
          where: { id: item.drugId },
          data: { stock: { increment: item.quantity } },
        });
        // Restore batch remaining if batch exists
        if (item.batchId) {
          await tx.drugBatch.update({
            where: { id: item.batchId },
            data: { remaining: { increment: item.quantity } },
          });
        }
        // Create inventory log (without batchId)
        await tx.inventoryLog.create({
          data: {
            drugId: item.drugId,
            type: "RETURN",
            quantity: item.quantity,
            previousStock: item.drug.stock,
            newStock: item.drug.stock + item.quantity,
            saleId: sale.id,
            batchNumber: item.batchNumber,
            notes: `Refund for sale ${sale.invoiceNumber}` + (reason ? `: ${reason}` : ""),
            userId,
          },
        });
      }
      // Create refund payment
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
      // Update sale status
      await tx.sale.update({
        where: { id: sale.id },
        data: { status: "REFUNDED" },
      });
      // Create audit log
      await tx.auditLog.create({
        data: {
          userId,
          action: "REFUND",
          entity: "Sale",
          entityId: sale.id,
          oldData: { status: sale.status },
          newData: { status: "REFUNDED" },
          ipAddress: request.headers.get("x-forwarded-for") || "unknown",
          userAgent: request.headers.get("user-agent") || "unknown",
        },
      });
    });

    return NextResponse.json({ success: true, message: "Sale refunded successfully" });
  } catch (error: any) {
    console.error("Refund error:", error);
    return NextResponse.json({ error: "Failed to process refund" }, { status: 500 });
  }
};