import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { startOfDay, endOfDay } from "date-fns";

function toNumber(value: any): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "object" && value !== null && "toNumber" in value) return value.toNumber();
  return Number(value);
}

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
    const lossValuation = searchParams.get("lossValuation") || "cost";

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
      case "profit-drug":
        result = await getDrugProfitLoss(gte, lte, lossValuation);
        break;
      case "profit-full":
        result = await getFullProfitLoss(gte, lte);
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
    where: { createdAt: { gte, lte }, status: "COMPLETED" },
    select: { id: true, invoiceNumber: true, createdAt: true, customerName: true, netAmount: true, paymentMethod: true },
    orderBy: { createdAt: "desc" },
  });
  let total = 0;
  for (const s of sales) total += toNumber(s.netAmount);
  return { total, count: sales.length, sales };
}

// ---------- Inventory Report ----------
async function getInventoryReport() {
  const drugs = await prisma.drug.findMany({
    where: { isActive: true },
    select: { price: true, stock: true, minStockLevel: true },
  });
  let totalValue = 0, lowStockCount = 0;
  for (const d of drugs) {
    totalValue += toNumber(d.price) * d.stock;
    if (d.stock <= d.minStockLevel) lowStockCount++;
  }
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
  const expiring = await prisma.drugBatch.findMany({
    where: { expiryDate: { lte: thirtyDaysFromNow }, remaining: { gt: 0 } },
    include: { drug: { select: { name: true } } },
    orderBy: { expiryDate: "asc" }, take: 100,
  });
  return { totalValue, lowStockCount, expiring };
}

// ---------- Drug Profit & Loss (includes inventory losses) ----------
async function getDrugProfitLoss(gte: Date, lte: Date, lossValuation: string) {
  // 1. Sales revenue and COGS
  const salesData = await prisma.saleItem.findMany({
    where: { sale: { createdAt: { gte, lte }, status: "COMPLETED" } },
    include: { drug: { select: { costPrice: true, price: true } } },
  });
  let revenue = 0, cogs = 0;
  for (const item of salesData) {
    revenue += toNumber(item.subtotal);
    cogs += item.quantity * toNumber(item.drug.costPrice);
  }
  const grossProfit = revenue - cogs;

  // 2. Losses from expired batches within the period (any batch that expired in the range)
  const expiredBatches = await prisma.drugBatch.findMany({
    where: {
      expiryDate: { gte, lte },
      remaining: { gt: 0 },
    },
    include: { drug: { select: { price: true, costPrice: true } } },
  });
  let lossFromExpiry = 0;
  for (const batch of expiredBatches) {
    const unitValue = lossValuation === "selling" ? toNumber(batch.drug.price) : toNumber(batch.drug.costPrice);
    lossFromExpiry += batch.remaining * unitValue;
  }

  // 3. Losses from damage and theft (if THEFT exists)
  const damageLogs = await prisma.inventoryLog.findMany({
    where: {
      createdAt: { gte, lte },
      type: { in: ["DAMAGE"] },
    },
    include: { drug: { select: { price: true, costPrice: true } } },
  });
  let lossFromDamage = 0;
  for (const log of damageLogs) {
    const unitValue = lossValuation === "selling" ? toNumber(log.drug.price) : toNumber(log.drug.costPrice);
    lossFromDamage += Math.abs(log.quantity) * unitValue;
  }

  // 4. Negative adjustments (stock reductions without a sale)
  const negativeAdjustments = await prisma.inventoryLog.findMany({
    where: {
      createdAt: { gte, lte },
      type: "ADJUSTMENT",
      quantity: { lt: 0 },
    },
    include: { drug: { select: { price: true, costPrice: true } } },
  });
  let lossFromAdjustment = 0;
  for (const log of negativeAdjustments) {
    const unitValue = lossValuation === "selling" ? toNumber(log.drug.price) : toNumber(log.drug.costPrice);
    lossFromAdjustment += Math.abs(log.quantity) * unitValue;
  }

  const totalLosses = lossFromExpiry + lossFromDamage + lossFromAdjustment;
  const netProfit = grossProfit - totalLosses;

  return {
    revenue,
    cogs,
    grossProfit,
    totalLosses,
    netProfit,
    lossValuationUsed: lossValuation,
    breakdown: { expiry: lossFromExpiry, damage: lossFromDamage, adjustment: lossFromAdjustment },
  };
}

// ---------- Full Profit & Loss (includes operational expenses) ----------
async function getFullProfitLoss(gte: Date, lte: Date) {
  // Revenue and COGS
  const salesData = await prisma.saleItem.findMany({
    where: { sale: { createdAt: { gte, lte }, status: "COMPLETED" } },
    include: { drug: { select: { costPrice: true } } },
  });
  let revenue = 0, cogs = 0;
  for (const item of salesData) {
    revenue += toNumber(item.subtotal);
    cogs += item.quantity * toNumber(item.drug.costPrice);
  }
  const grossProfit = revenue - cogs;

  // Losses from expired batches (cost price)
  const expiredBatches = await prisma.drugBatch.findMany({
    where: { expiryDate: { gte, lte }, remaining: { gt: 0 } },
    include: { drug: { select: { costPrice: true } } },
  });
  let lossFromExpiry = 0;
  for (const batch of expiredBatches) lossFromExpiry += batch.remaining * toNumber(batch.drug.costPrice);

  // Losses from damage and theft (cost price)
  const damageLogs = await prisma.inventoryLog.findMany({
    where: { createdAt: { gte, lte }, type: { in: ["DAMAGE"] } },
    include: { drug: { select: { costPrice: true } } },
  });
  let lossFromDamage = 0;
  for (const log of damageLogs) lossFromDamage += Math.abs(log.quantity) * toNumber(log.drug.costPrice);

  // Negative adjustments (cost price)
  const negativeAdjustments = await prisma.inventoryLog.findMany({
    where: { createdAt: { gte, lte }, type: "ADJUSTMENT", quantity: { lt: 0 } },
    include: { drug: { select: { costPrice: true } } },
  });
  let lossFromAdjustment = 0;
  for (const log of negativeAdjustments) lossFromAdjustment += Math.abs(log.quantity) * toNumber(log.drug.costPrice);

  const totalLosses = lossFromExpiry + lossFromDamage + lossFromAdjustment;

  // Operating expenses
  const expenses = await prisma.expense.findMany({
    where: { date: { gte, lte } },
    select: { amount: true },
  });
  let totalExpenses = 0;
  for (const exp of expenses) totalExpenses += toNumber(exp.amount);

  const netProfit = grossProfit - totalLosses - totalExpenses;

  return { revenue, cogs, grossProfit, totalLosses, totalExpenses, netProfit };
}