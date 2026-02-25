import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/app/lib/prisma";
import { auth } from "@/app/lib/auth";
import { startOfDay, endOfDay, subDays, subMonths, format } from "date-fns";


type CustomerMetrics = {
  unique_customers: number | null;
  unique_emails: number | null;
  avg_transaction_value: number | null;
  max_transaction_value: number | null;
  min_transaction_value: number | null;
};


export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "month";
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    
    let dateFilter: any = {};
    const now = new Date();
    
    if (startDate && endDate) {
      dateFilter = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    } else {
      switch (period) {
        case "today":
          dateFilter = {
            gte: startOfDay(now),
            lte: endOfDay(now),
          };
          break;
        case "week":
          dateFilter = {
            gte: subDays(now, 7),
            lte: now,
          };
          break;
        case "month":
          dateFilter = {
            gte: subDays(now, 30),
            lte: now,
          };
          break;
        case "year":
          dateFilter = {
            gte: subMonths(now, 12),
            lte: now,
          };
          break;
      }
    }

    // Get sales summary
    const salesSummary = await prisma.sale.aggregate({
      where: {
        createdAt: dateFilter,
        status: "COMPLETED",
      },
      _sum: {
        totalAmount: true,
        discount: true,
        tax: true,
        netAmount: true,
      },
      _count: true,
    });

    // Get daily sales trend
    const salesTrend = await prisma.$queryRaw`
      SELECT 
        DATE("createdAt") as date,
        COUNT(*) as transactions,
        SUM("totalAmount") as total_sales,
        SUM("netAmount") as net_sales,
        AVG("totalAmount") as avg_ticket
      FROM "Sale"
      WHERE "createdAt" >= ${dateFilter.gte}
        AND "createdAt" <= ${dateFilter.lte}
        AND "status" = 'COMPLETED'
      GROUP BY DATE("createdAt")
      ORDER BY date ASC
    `;

    // Get top selling drugs
    const topDrugs = await prisma.$queryRaw`
      SELECT 
        d.id,
        d.name,
        d.genericName,
        d.brand,
        d.category,
        COUNT(si.id) as times_sold,
        SUM(si.quantity) as total_quantity,
        SUM(si.subtotal) as total_revenue,
        AVG(si.unitPrice) as avg_price
      FROM "Drug" d
      JOIN "SaleItem" si ON d.id = si."drugId"
      JOIN "Sale" s ON si."saleId" = s.id
      WHERE s."createdAt" >= ${dateFilter.gte}
        AND s."createdAt" <= ${dateFilter.lte}
        AND s."status" = 'COMPLETED'
      GROUP BY d.id, d.name, d.genericName, d.brand, d.category
      ORDER BY total_quantity DESC
      LIMIT 20
    `;

    // Get top performing staff
    const topStaff = await prisma.$queryRaw`
      SELECT 
        u.id,
        u.name,
        u.email,
        u.role,
        COUNT(s.id) as transactions,
        SUM(s."totalAmount") as total_sales,
        SUM(s."netAmount") as net_sales
      FROM "User" u
      JOIN "Sale" s ON u.id = s."userId"
      WHERE s."createdAt" >= ${dateFilter.gte}
        AND s."createdAt" <= ${dateFilter.lte}
        AND s."status" = 'COMPLETED'
      GROUP BY u.id, u.name, u.email, u.role
      ORDER BY total_sales DESC
      LIMIT 10
    `;

    // Get inventory status
    const inventoryStatus = await prisma.$queryRaw`
      SELECT 
        category,
        COUNT(*) as total_items,
        SUM(stock) as total_stock,
        SUM(CASE WHEN stock <= "minStockLevel" THEN 1 ELSE 0 END) as low_stock_items,
        SUM(CASE WHEN stock = 0 THEN 1 ELSE 0 END) as out_of_stock_items,
        SUM(price * stock) as total_value
      FROM "Drug"
      WHERE "isActive" = true
      GROUP BY category
      ORDER BY category
    `;

    // Get sales by payment method
    const salesByPayment = await prisma.$queryRaw`
      SELECT 
        "paymentMethod",
        COUNT(*) as transactions,
        SUM("totalAmount") as total_amount,
        SUM("netAmount") as net_amount
      FROM "Sale"
      WHERE "createdAt" >= ${dateFilter.gte}
        AND "createdAt" <= ${dateFilter.lte}
        AND "status" = 'COMPLETED'
      GROUP BY "paymentMethod"
      ORDER BY total_amount DESC
    `;

    // Get customer metrics
    const customerMetrics = await prisma.$queryRaw<CustomerMetrics[]>`
      SELECT 
        COUNT(DISTINCT "customerPhone") as unique_customers,
        COUNT(DISTINCT "customerEmail") as unique_emails,
        AVG("totalAmount") as avg_transaction_value,
        MAX("totalAmount") as max_transaction_value,
        MIN("totalAmount") as min_transaction_value
      FROM "Sale"
      WHERE "createdAt" >= ${dateFilter.gte}
        AND "createdAt" <= ${dateFilter.lte}
        AND "status" = 'COMPLETED'
    `;
    
    // Get drug category performance
    const categoryPerformance = await prisma.$queryRaw`
      SELECT 
        d.category,
        COUNT(si.id) as transactions,
        SUM(si.quantity) as quantity_sold,
        SUM(si.subtotal) as revenue,
        AVG(si.unitPrice) as avg_price
      FROM "Drug" d
      JOIN "SaleItem" si ON d.id = si."drugId"
      JOIN "Sale" s ON si."saleId" = s.id
      WHERE s."createdAt" >= ${dateFilter.gte}
        AND s."createdAt" <= ${dateFilter.lte}
        AND s."status" = 'COMPLETED'
      GROUP BY d.category
      ORDER BY revenue DESC
    `;

    // Get profit margin analysis
    const profitAnalysis = await prisma.$queryRaw`
      SELECT 
        d.id,
        d.name,
        d.category,
        SUM(si.quantity) as quantity_sold,
        SUM(si.subtotal) as revenue,
        SUM(si.quantity * d."costPrice") as cost,
        SUM(si.subtotal - (si.quantity * d."costPrice")) as profit,
        (SUM(si.subtotal - (si.quantity * d."costPrice")) / SUM(si.subtotal)) * 100 as profit_margin
      FROM "Drug" d
      JOIN "SaleItem" si ON d.id = si."drugId"
      JOIN "Sale" s ON si."saleId" = s.id
      WHERE s."createdAt" >= ${dateFilter.gte}
        AND s."createdAt" <= ${dateFilter.lte}
        AND s."status" = 'COMPLETED'
      GROUP BY d.id, d.name, d.category
      HAVING SUM(si.subtotal) > 0
      ORDER BY profit DESC
      LIMIT 15
    `;

    // Get hourly sales pattern
    const hourlyPattern = await prisma.$queryRaw`
      SELECT 
        EXTRACT(HOUR FROM "createdAt") as hour,
        COUNT(*) as transactions,
        SUM("totalAmount") as total_sales
      FROM "Sale"
      WHERE "createdAt" >= ${dateFilter.gte}
        AND "createdAt" <= ${dateFilter.lte}
        AND "status" = 'COMPLETED'
      GROUP BY EXTRACT(HOUR FROM "createdAt")
      ORDER BY hour
    `;

    return NextResponse.json({
      summary: {
        totalSales: salesSummary._sum.totalAmount || 0,
        totalDiscount: salesSummary._sum.discount || 0,
        totalTax: salesSummary._sum.tax || 0,
        netSales: salesSummary._sum.netAmount || 0,
        totalTransactions: salesSummary._count,
      },
      salesTrend,
      topDrugs,
      topStaff,
      inventoryStatus,
      salesByPayment,
      customerMetrics: customerMetrics[0] || {},
      categoryPerformance,
      profitAnalysis,
      hourlyPattern,
    });
  } catch (error: any) {
    console.error("Analytics error:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500 }
    );
  }
}