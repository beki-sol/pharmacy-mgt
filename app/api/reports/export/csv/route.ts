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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "sales";
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const lossValuation = searchParams.get("lossValuation") || "cost";

    if (!startDate || !endDate) {
      return NextResponse.json({ error: "Missing date range" }, { status: 400 });
    }

    const gte = new Date(startDate);
    const lte = endOfDay(new Date(endDate));

    let csvData = "";
    let filename = "";

    switch (type) {
      case "sales":
        filename = `sales_report_${startDate}_to_${endDate}.csv`;
        csvData = await generateSalesCSV(gte, lte);
        break;
      case "inventory":
        filename = `inventory_report.csv`;
        csvData = await generateInventoryCSV();
        break;
      case "profit-drug":
        filename = `profit_drug_report_${startDate}_to_${endDate}.csv`;
        csvData = await generateDrugProfitCSV(gte, lte, lossValuation);
        break;
      case "profit-full":
        filename = `profit_full_report_${startDate}_to_${endDate}.csv`;
        csvData = await generateFullProfitCSV(gte, lte);
        break;
      default:
        return NextResponse.json({ error: "Invalid report type" }, { status: 400 });
    }

    return new NextResponse(csvData, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("CSV export error:", error);
    return NextResponse.json({ error: "Failed to generate CSV" }, { status: 500 });
  }
}

async function generateSalesCSV(gte: Date, lte: Date) {
  const sales = await prisma.sale.findMany({
    where: { createdAt: { gte, lte }, status: "COMPLETED" },
    orderBy: { createdAt: "desc" },
  });
  const headers = ["Invoice Number", "Date", "Customer", "Amount", "Payment Method", "Status"];
  const rows = sales.map(s => [
    s.invoiceNumber,
    new Date(s.createdAt).toISOString().split('T')[0],
    s.customerName || "Guest",
    toNumber(s.netAmount).toFixed(2),
    s.paymentMethod,
    s.status,
  ]);
  return [headers, ...rows].map(row => row.join(",")).join("\n");
}

async function generateInventoryCSV() {
  const drugs = await prisma.drug.findMany({
    where: { isActive: true },
    include: { category: true },
  });
  const headers = ["Name", "Generic Name", "Category", "Stock", "Price", "Min Stock", "Expiry Date"];
  const rows = drugs.map(d => [
    d.name,
    d.genericName || "",
    d.category?.name || "",
    d.stock,
    toNumber(d.price).toFixed(2),
    d.minStockLevel,
    d.expiryDate ? new Date(d.expiryDate).toISOString().split('T')[0] : "",
  ]);
  return [headers, ...rows].map(row => row.join(",")).join("\n");
}

async function generateDrugProfitCSV(gte: Date, lte: Date, lossValuation: string) {
  // Sales revenue and COGS
  const salesItems = await prisma.saleItem.findMany({
    where: { sale: { createdAt: { gte, lte }, status: "COMPLETED" } },
    include: { drug: { select: { costPrice: true, price: true } } },
  });
  let revenue = 0, cogs = 0;
  for (const item of salesItems) {
    revenue += toNumber(item.subtotal);
    cogs += item.quantity * toNumber(item.drug.costPrice);
  }
  const grossProfit = revenue - cogs;

  // Loss from expired batches
  const expiredBatches = await prisma.drugBatch.findMany({
    where: { expiryDate: { gte, lte }, remaining: { gt: 0 } },
    include: { drug: { select: { price: true, costPrice: true } } },
  });
  let lossExpiry = 0;
  for (const batch of expiredBatches) {
    const unitValue = lossValuation === "selling" ? toNumber(batch.drug.price) : toNumber(batch.drug.costPrice);
    lossExpiry += batch.remaining * unitValue;
  }

  // Loss from damage/theft
  const damageLogs = await prisma.inventoryLog.findMany({
    where: { createdAt: { gte, lte }, type: { in: ["DAMAGE"] } },
    include: { drug: { select: { price: true, costPrice: true } } },
  });
  let lossDamage = 0;
  for (const log of damageLogs) {
    const unitValue = lossValuation === "selling" ? toNumber(log.drug.price) : toNumber(log.drug.costPrice);
    lossDamage += Math.abs(log.quantity) * unitValue;
  }

  // Loss from negative adjustments
  const negAdjust = await prisma.inventoryLog.findMany({
    where: { createdAt: { gte, lte }, type: "ADJUSTMENT", quantity: { lt: 0 } },
    include: { drug: { select: { price: true, costPrice: true } } },
  });
  let lossAdj = 0;
  for (const log of negAdjust) {
    const unitValue = lossValuation === "selling" ? toNumber(log.drug.price) : toNumber(log.drug.costPrice);
    lossAdj += Math.abs(log.quantity) * unitValue;
  }

  const totalLosses = lossExpiry + lossDamage + lossAdj;
  const netProfit = grossProfit - totalLosses;

  const headers = ["Metric", "Value"];
  const rows = [
    ["Revenue", revenue.toFixed(2)],
    ["Cost of Goods Sold", cogs.toFixed(2)],
    ["Gross Profit", grossProfit.toFixed(2)],
    ["Expired Losses", lossExpiry.toFixed(2)],
    ["Damage/Theft Losses", lossDamage.toFixed(2)],
    ["Adjustment Losses", lossAdj.toFixed(2)],
    ["Total Losses", totalLosses.toFixed(2)],
    ["Net Profit", netProfit.toFixed(2)],
  ];
  return [headers, ...rows].map(row => row.join(",")).join("\n");
}

async function generateFullProfitCSV(gte: Date, lte: Date) {
  // Sales revenue and COGS
  const salesItems = await prisma.saleItem.findMany({
    where: { sale: { createdAt: { gte, lte }, status: "COMPLETED" } },
    include: { drug: { select: { costPrice: true } } },
  });
  let revenue = 0, cogs = 0;
  for (const item of salesItems) {
    revenue += toNumber(item.subtotal);
    cogs += item.quantity * toNumber(item.drug.costPrice);
  }
  const grossProfit = revenue - cogs;

  // Loss from expired batches (cost price)
  const expiredBatches = await prisma.drugBatch.findMany({
    where: { expiryDate: { gte, lte }, remaining: { gt: 0 } },
    include: { drug: { select: { costPrice: true } } },
  });
  let lossExpiry = 0;
  for (const batch of expiredBatches) lossExpiry += batch.remaining * toNumber(batch.drug.costPrice);

  // Loss from damage/theft (cost price)
  const damageLogs = await prisma.inventoryLog.findMany({
    where: { createdAt: { gte, lte }, type: { in: ["DAMAGE"] } },
    include: { drug: { select: { costPrice: true } } },
  });
  let lossDamage = 0;
  for (const log of damageLogs) lossDamage += Math.abs(log.quantity) * toNumber(log.drug.costPrice);

  // Loss from negative adjustments (cost price)
  const negAdjust = await prisma.inventoryLog.findMany({
    where: { createdAt: { gte, lte }, type: "ADJUSTMENT", quantity: { lt: 0 } },
    include: { drug: { select: { costPrice: true } } },
  });
  let lossAdj = 0;
  for (const log of negAdjust) lossAdj += Math.abs(log.quantity) * toNumber(log.drug.costPrice);

  const totalLosses = lossExpiry + lossDamage + lossAdj;

  // Operating expenses
  const expenses = await prisma.expense.findMany({
    where: { date: { gte, lte } },
    select: { amount: true },
  });
  let totalExpenses = 0;
  for (const exp of expenses) totalExpenses += toNumber(exp.amount);

  const netProfit = grossProfit - totalLosses - totalExpenses;

  const headers = ["Metric", "Value"];
  const rows = [
    ["Revenue", revenue.toFixed(2)],
    ["Cost of Goods Sold", cogs.toFixed(2)],
    ["Gross Profit", grossProfit.toFixed(2)],
    ["Expired Losses", lossExpiry.toFixed(2)],
    ["Damage/Theft Losses", lossDamage.toFixed(2)],
    ["Adjustment Losses", lossAdj.toFixed(2)],
    ["Total Inventory Losses", totalLosses.toFixed(2)],
    ["Operating Expenses", totalExpenses.toFixed(2)],
    ["Net Profit", netProfit.toFixed(2)],
  ];
  return [headers, ...rows].map(row => row.join(",")).join("\n");
}