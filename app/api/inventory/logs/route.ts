import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const logs = await prisma.inventoryLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 100, // limit for performance, you can add pagination later
      include: {
        drug: { select: { name: true } },
        user: { select: { name: true } },
      },
    });

    // Transform to match the expected shape in the frontend
    const formattedLogs = logs.map(log => ({
      id: log.id,
      drugId: log.drugId,
      drugName: log.drug.name,
      type: log.type,
      quantity: log.quantity,
      previousStock: log.previousStock,
      newStock: log.newStock,
      referenceType: "MANUAL", // or from your schema if you have it
      referenceId: log.saleId || log.purchaseOrderId || "",
      notes: log.notes || "",
      createdAt: log.createdAt.toISOString(),
      user: { name: log.user?.name || "System" },
    }));

    return NextResponse.json({ logs: formattedLogs });
  } catch (error) {
    console.error("GET /inventory/logs error:", error);
    return NextResponse.json({ error: "Failed to fetch inventory logs" }, { status: 500 });
  }
}