import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const type = searchParams.get("type"); // e.g., "SALE", "PURCHASE", "ADJUSTMENT", "DAMAGE", "RETURN", "EXPIRED"
    const search = searchParams.get("search") || "";
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const skip = (page - 1) * limit;
    let where: any = {};

    if (type && type !== "ALL") {
      where.type = type;
    }
    if (search) {
      where.drug = { name: { contains: search, mode: "insensitive" } };
    }
    if (startDate && endDate) {
      where.createdAt = { gte: new Date(startDate), lte: new Date(endDate) };
    }

    const [logs, total] = await Promise.all([
      prisma.inventoryLog.findMany({
        where,
        include: {
          drug: { select: { name: true, genericName: true, unit: true } },
          user: { select: { name: true } },
          sale: { select: { invoiceNumber: true } },
          purchaseOrder: { select: { orderNumber: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.inventoryLog.count({ where }),
    ]);

    const formattedLogs = logs.map(log => ({
      id: log.id,
      drugId: log.drugId,
      drugName: log.drug.name,
      drugGenericName: log.drug.genericName,
      drugUnit: log.drug.unit,
      type: log.type,
      quantity: log.quantity,
      previousStock: log.previousStock,
      newStock: log.newStock,
      batchNumber: log.batchNumber,
      notes: log.notes || "",
      createdAt: log.createdAt.toISOString(),
      user: { name: log.user?.name || "System" },
      reference: log.sale ? { invoiceNumber: log.sale.invoiceNumber } : log.purchaseOrder ? { orderNumber: log.purchaseOrder.orderNumber } : null,
    }));

    return NextResponse.json({
      logs: formattedLogs,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("GET /inventory/logs error:", error);
    return NextResponse.json({ error: "Failed to fetch inventory logs" }, { status: 500 });
  }
}