import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { startOfDay, endOfDay } from "date-fns";

// Helper to convert any value to number (handles Decimal, null, etc.)
function toNumber(value: any): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "object" && value !== null && "toNumber" in value) {
    return value.toNumber();
  }
  return Number(value);
}

// Recursive conversion for JSON serialization
function convertBigIntsAndDecimals(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "bigint") return Number(obj);
  if (typeof obj === "object" && "toNumber" in obj) return obj.toNumber();
  if (Array.isArray(obj)) return obj.map(convertBigIntsAndDecimals);
  if (typeof obj === "object") {
    const result: any = {};
    for (const key in obj) result[key] = convertBigIntsAndDecimals(obj[key]);
    return result;
  }
  return obj;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "sales";
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    if (!startDate || !endDate) {
      return NextResponse.json({ error: "startDate and endDate are required" }, { status: 400 });
    }

    const gte = new Date(startDate);
    const lte = endOfDay(new Date(endDate));

    let result;

    switch (type) {
      case "sales":
        result = await getSalesReport(gte, lte);
        break;
      case "inventory":
        result = await getInventoryReport();
        break;
      case "profit":
        result = await getProfitReport(gte, lte);
        break;
      default:
        return NextResponse.json({ error: "Invalid report type" }, { status: 400 });
    }

    return NextResponse.json(convertBigIntsAndDecimals(result));
  } catch (error) {
    console.error("Reports API error:", error);
    return NextResponse.json({ error: "Failed to generate report" }, { status: 500 });
  }
}

// ---------- Sales Report ----------
async function getSalesReport(gte: Date, lte: Date) {
  const sales = await prisma.sale.findMany({
    where: {
      createdAt: { gte, lte },
      status: "COMPLETED",
    },
    select: {
      id: true,
      invoiceNumber: true,
      createdAt: true,
      customerName: true,
      netAmount: true,
      paymentMethod: true,
    },
    orderBy: { createdAt: "desc" },
  });

  // Convert Decimal to number for calculations
  let total = 0;
  for (const s of sales) {
    total += toNumber(s.netAmount);
  }
  const count = sales.length;

  return {
    total,
    count,
    sales, // will be converted later
  };
}

// ---------- Inventory Report ----------
async function getInventoryReport() {
  const drugs = await prisma.drug.findMany({
    where: { isActive: true },
    select: { price: true, stock: true, minStockLevel: true },
  });

  let totalValue = 0;
  let lowStockCount = 0;
  for (const d of drugs) {
    totalValue += toNumber(d.price) * d.stock;
    if (d.stock <= d.minStockLevel) lowStockCount++;
  }

  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
  const expiring = await prisma.drugBatch.findMany({
    where: {
      expiryDate: { lte: thirtyDaysFromNow },
      remaining: { gt: 0 },
    },
    include: { drug: { select: { name: true } } },
    orderBy: { expiryDate: "asc" },
    take: 100,
  });

  return {
    totalValue,
    lowStockCount,
    expiring,
  };
}

// ---------- Profit & Loss Report ----------
async function getProfitReport(gte: Date, lte: Date) {
  const sales = await prisma.sale.findMany({
    where: {
      createdAt: { gte, lte },
      status: "COMPLETED",
    },
    include: {
      saleItems: {
        include: { drug: { select: { costPrice: true } } },
      },
    },
  });

  let revenue = 0;
  let cost = 0;

  for (const sale of sales) {
    revenue += toNumber(sale.netAmount);
    for (const item of sale.saleItems) {
      cost += item.quantity * toNumber(item.drug.costPrice);
    }
  }

  const profit = revenue - cost;
  const margin = revenue ? (profit / revenue) * 100 : 0;

  return {
    revenue,
    cost,
    profit,
    margin,
  };
}