import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const tx_ref = request.nextUrl.searchParams.get("tx_ref");
    if (!tx_ref) {
      return NextResponse.json({ error: "Missing tx_ref" }, { status: 400 });
    }

    // 1. Verify with Chapa
    const verifyUrl = `https://api.chapa.co/v1/transaction/verify/${tx_ref}`;
    const response = await fetch(verifyUrl, {
      headers: { Authorization: `Bearer ${process.env.CHAPA_SECRET_KEY}` },
    });
    const chapaData = await response.json();

    if (chapaData.status !== "success") {
      return NextResponse.json({ error: "Payment not successful" }, { status: 400 });
    }

    // 2. Find the pending payment with its sale
    const payment = await prisma.payment.findUnique({
      where: { chapaTxRef: tx_ref },
      include: { sale: { include: { saleItems: true } } },
    });

    if (!payment) {
      return NextResponse.json({ error: "Payment record not found" }, { status: 404 });
    }

    // Ensure sale exists (it should, because we included it)
    if (!payment.sale) {
      return NextResponse.json({ error: "Associated sale not found" }, { status: 404 });
    }

    if (payment.status === "COMPLETED") {
      return NextResponse.json({ success: true, message: "Already verified" });
    }

    // 3. Update sale, payment, and deduct stock
    await prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: "COMPLETED",
          paidAt: new Date(),
          chapaTxId: chapaData.data?.id,
        },
      });

      await tx.sale.update({
        where: { id: payment.saleId! },
        data: { status: "COMPLETED" },
      });

      for (const item of payment.sale!.saleItems) {
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
            await tx.drugBatch.update({
              where: { id: item.batchId },
              data: { remaining: batch.remaining - item.quantity },
            });
          }
        }

        await tx.inventoryLog.create({
          data: {
            drugId: item.drugId,
            type: "SALE",
            quantity: -item.quantity,
            previousStock: drug.stock,
            newStock,
            saleId: payment.saleId,
            batchNumber: item.batchNumber,
            userId: payment.sale!.userId,
          },
        });
      }
    });

    return NextResponse.json({ success: true, saleId: payment.saleId });
  } catch (error: any) {
    console.error("Verification error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}