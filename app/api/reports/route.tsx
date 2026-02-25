import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { auth } from "@/app/lib/auth";
import { startOfDay, endOfDay, subDays, subMonths } from "date-fns";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "sales";
    const period = searchParams.get("period") || "month";
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    let dateFilter: any = {};
    const now = new Date();

    if (startDate && endDate) {
      dateFilter = { gte: new Date(startDate), lte: new Date(endDate) };
    } else {
      switch (period) {
        case "day":
          dateFilter = { gte: startOfDay(now), lte: endOfDay(now) };
          break;
        case "week":
          dateFilter = { gte: subDays(now, 7), lte: now };
          break;
        case "month":
          dateFilter = { gte: subMonths(now, 1), lte: now };
          break;
        case "year":
          dateFilter = { gte: subMonths(now, 12), lte: now };
          break;
      }
    }

    let data: any;

    if (type === "sales") {
      const sales = await prisma.sale.findMany({
        where: { createdAt: dateFilter, status: "COMPLETED" },
        include: { saleItems: { include: { drug: true } }, user: true },
      });

      const total = sales.reduce((sum, s) => sum + s.netAmount.toNumber(), 0);
      const count = sales.length;
      const byPaymentMethod = sales.reduce((acc: Record<string, number>, s) => {
        const method = s.paymentMethod;
        acc[method] = (acc[method] || 0) + s.netAmount.toNumber();
        return acc;
      }, {});

      data = { total, count, byPaymentMethod, sales };
    } else if (type === "inventory") {
      const drugs = await prisma.drug.findMany({
        where: { isActive: true },
        include: { supplier: true },
      });

      const totalValue = drugs.reduce((sum, d) => sum + d.stock * d.costPrice.toNumber(), 0);
      const lowStock = drugs.filter(d => d.stock <= d.minStockLevel);
      const expiring = await prisma.drugBatch.findMany({
        where: { expiryDate: { lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) }, remaining: { gt: 0 } },
        include: { drug: true },
      });

      data = { totalValue, lowStockCount: lowStock.length, lowStock, expiring };
    } else if (type === "profit") {
      const sales = await prisma.sale.findMany({
        where: { createdAt: dateFilter, status: "COMPLETED" },
        include: { saleItems: { include: { drug: true } } },
      });

      let revenue = 0, cost = 0;
      sales.forEach(sale => {
        revenue += sale.netAmount.toNumber();
        sale.saleItems.forEach(item => {
          cost += item.quantity * (item.drug?.costPrice?.toNumber() || 0);
        });
      });

      const profit = revenue - cost;
      const margin = revenue ? (profit / revenue) * 100 : 0;

      data = { revenue, cost, profit, margin };
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Reports error:", error);
    return NextResponse.json({ error: "Failed to generate report" }, { status: 500 });
  }
}