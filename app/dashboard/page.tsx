"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/Card";
import { Header } from "@/app/components/dashboard/Header";
import { SalesChart } from "@/app/components/analytics/SalesChart";
import { DollarSign, ShoppingCart, Users, Package, TrendingUp, TrendingDown } from "lucide-react";
import { Badge } from "@/app/components/ui/Badge";
import { Button } from "@/app/components/ui/Button";
import Link from "next/link";
import { formatCurrency } from "@/app/lib/utils";

interface DashboardStats {
  totalSales: number;
  totalTransactions: number;
  averageTicket: number;
  totalProfit: number;
  inventoryValue: number;
  lowStockItems: number;
}

interface RecentSale {
  id: string;
  invoiceNumber: string;
  customerName: string;
  netAmount: number;
}

interface SalesTrend {
  date: string;
  sales: number;
  transactions: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentSales, setRecentSales] = useState<RecentSale[]>([]);
  const [salesTrend, setSalesTrend] = useState<SalesTrend[]>([]);
  const [lowStock, setLowStock] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [statsRes, salesRes, lowStockRes] = await Promise.all([
          fetch("/api/analytics?period=month"), // We'll create a summary endpoint or use analytics
          fetch("/api/sales?limit=5&sortBy=createdAt&sortOrder=desc"),
          fetch("/api/drugs?lowStock=true&limit=5"),
        ]);

        const statsData = await statsRes.json();
        const salesData = await salesRes.json();
        const lowStockData = await lowStockRes.json();

        // Extract stats from analytics
        setStats({
          totalSales: statsData.summary?.totalSales || 0,
          totalTransactions: statsData.summary?.totalTransactions || 0,
          averageTicket: statsData.customerMetrics?.avg_transaction_value || 0,
          totalProfit: statsData.profitAnalysis?.reduce((acc: number, p: any) => acc + p.profit, 0) || 0,
          inventoryValue: statsData.inventoryStatus?.reduce((acc: number, i: any) => acc + i.total_value, 0) || 0,
          lowStockItems: statsData.inventoryStatus?.reduce((acc: number, i: any) => acc + i.low_stock_items, 0) || 0,
        });

        setRecentSales(salesData.sales || []);
        setSalesTrend(statsData.salesTrend || []);
        setLowStock(lowStockData.alerts?.lowStock || []);
      } catch (error) {
        console.error("Failed to fetch dashboard data", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <>
        <Header title="Dashboard" subtitle="Welcome back" showSearch />
        <div className="p-6 flex items-center justify-center h-64">Loading...</div>
      </>
    );
  }

  const summaryCards = stats ? [
    { title: "Total Sales", value: formatCurrency(stats.totalSales), change: "+12.5%", trend: "up", icon: DollarSign },
    { title: "Transactions", value: stats.totalTransactions.toLocaleString(), change: "+8.3%", trend: "up", icon: ShoppingCart },
    { title: "Avg Ticket", value: formatCurrency(stats.averageTicket), change: "+4.2%", trend: "up", icon: Users },
    { title: "Total Profit", value: formatCurrency(stats.totalProfit), change: "+15.1%", trend: "up", icon: TrendingUp },
    { title: "Inventory Value", value: formatCurrency(stats.inventoryValue), change: "-2.3%", trend: "down", icon: Package },
    { title: "Low Stock", value: stats.lowStockItems.toString(), change: "+2", trend: "up", icon: Package },
  ] : [];

  return (
    <>
      <Header title="Dashboard" subtitle="Welcome back, Admin" showSearch />
      <div className="p-6 space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {summaryCards.map((card, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{card.title}</p>
                    <p className="text-2xl font-bold">{card.value}</p>
                    <div className="flex items-center mt-2 text-xs">
                      {card.trend === "up" ? (
                        <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
                      ) : (
                        <TrendingDown className="h-3 w-3 text-red-500 mr-1" />
                      )}
                      <span className={card.trend === "up" ? "text-green-600" : "text-red-600"}>
                        {card.change}
                      </span>
                      <span className="text-muted-foreground ml-2">vs last period</span>
                    </div>
                  </div>
                  <div className="p-3 bg-primary/10 rounded-full">
                    <card.icon className="h-5 w-5 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <SalesChart data={salesTrend} />
          </div>
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Recent Sales</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {recentSales.map((sale) => (
                  <div key={sale.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                    <div>
                      <p className="font-medium">{sale.invoiceNumber}</p>
                      <p className="text-sm text-muted-foreground">{sale.customerName || "Guest"}</p>
                    </div>
                    <span className="font-semibold">{formatCurrency(sale.netAmount)}</span>
                  </div>
                ))}
                <Button variant="outline" className="w-full" asChild>
                  <Link href="/dashboard/sales">View All</Link>
                </Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Low Stock Alerts</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {lowStock.map((drug: any) => (
                  <div key={drug.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                    <div>
                      <p className="font-medium">{drug.name}</p>
                      <p className="text-sm text-muted-foreground">Stock: {drug.stock} (Min: {drug.minStockLevel})</p>
                    </div>
                    <Badge variant="destructive">Reorder</Badge>
                  </div>
                ))}
                <Button variant="outline" className="w-full" asChild>
                  <Link href="/dashboard/drugs?lowStock=true">View All</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
