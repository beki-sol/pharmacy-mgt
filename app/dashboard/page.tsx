"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/Card";
import { Header } from "@/app/components/dashboard/Header";
import { SalesChart } from "@/app/components/analytics/SalesChart";
import { DollarSign, ShoppingCart, Users, Package, TrendingUp, TrendingDown, Plus, AlertCircle, Clock } from "lucide-react";
import { Badge } from "@/app/components/ui/Badge";
import { Button } from "@/app/components/ui/Button";
import Link from "next/link";
import { formatCurrency } from "@/app/lib/utils";
import { format, parseISO } from "date-fns";

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
  createdAt: string;
}

interface SalesTrend {
  date: string;
  sales: number;
  transactions: number;
}

interface TopDrug {
  id: string;
  name: string;
  total_quantity: number;
  total_revenue: number;
}

interface InventoryActivity {
  id: string;
  drugName: string;
  type: string;
  quantity: number;
  createdAt: string;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentSales, setRecentSales] = useState<RecentSale[]>([]);
  const [salesTrend, setSalesTrend] = useState<SalesTrend[]>([]);
  const [lowStock, setLowStock] = useState<any[]>([]);
  const [topDrugs, setTopDrugs] = useState<TopDrug[]>([]);
  const [recentActivities, setRecentActivities] = useState<InventoryActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [statsRes, salesRes, lowStockRes, topDrugsRes, activitiesRes] = await Promise.all([
          fetch("/api/analytics?period=month"),
          fetch("/api/sales?limit=5&sortBy=createdAt&sortOrder=desc"),
          fetch("/api/drug?lowStock=true&limit=5"),
          fetch("/api/analytics?period=month"), // same call, but we can reuse statsData
          fetch("/api/inventory/logs?limit=5"),
        ]);

        const statsData = await statsRes.json();
        const salesData = await salesRes.json();
        const lowStockData = await lowStockRes.json();
        const activitiesData = await activitiesRes.json();

        // Extract stats
        setStats({
          totalSales: statsData.summary?.totalSales || 0,
          totalTransactions: statsData.summary?.totalTransactions || 0,
          averageTicket: statsData.customerMetrics?.avg_transaction_value || 0,
          totalProfit: statsData.profitAnalysis?.reduce((acc: number, p: any) => acc + p.profit, 0) || 0,
          inventoryValue: statsData.inventoryStatus?.reduce((acc: number, i: any) => acc + i.total_value, 0) || 0,
          lowStockItems: statsData.inventoryStatus?.reduce((acc: number, i: any) => acc + i.low_stock_items, 0) || 0,
        });

        setRecentSales(salesData.sales || []);
        setLowStock(lowStockData.alerts?.lowStock || []);
        setTopDrugs(statsData.topDrugs?.slice(0, 5) || []);
        setRecentActivities(activitiesData.logs || []);

        // Process sales trend: ensure date is a valid string
        const trend = (statsData.salesTrend || []).map((item: any) => ({
          ...item,
          date: item.date ? format(parseISO(item.date), "MMM dd") : "Invalid",
        }));
        setSalesTrend(trend);
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
        <div className="p-6 flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
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
        {/* Summary Cards */}
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

        {/* Quick Actions */}
        <div className="grid gap-4 md:grid-cols-4">
          <Button asChild variant="outline" className="h-auto py-4">
            <Link href="/dashboard/sales/new">
              <Plus className="mr-2 h-5 w-5" />
              New Sale
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-auto py-4">
            <Link href="/dashboard/drugs/new">
              <Plus className="mr-2 h-5 w-5" />
              Add Drug
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-auto py-4">
            <Link href="/dashboard/inventory">
              <Package className="mr-2 h-5 w-5" />
              Manage Stock
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-auto py-4">
            <Link href="/dashboard/reports">
              <TrendingUp className="mr-2 h-5 w-5" />
              View Reports
            </Link>
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Sales Chart */}
          <div className="lg:col-span-2">
            <SalesChart data={salesTrend} />
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Recent Sales */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Sales</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {recentSales.length === 0 ? (
                  <p className="text-muted-foreground text-center">No recent sales</p>
                ) : (
                  recentSales.map((sale) => (
                    <div key={sale.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                      <div>
                        <p className="font-medium">{sale.invoiceNumber}</p>
                        <p className="text-sm text-muted-foreground">{sale.customerName || "Guest"}</p>
                        <p className="text-xs text-muted-foreground">
                          {sale.createdAt ? format(parseISO(sale.createdAt), "MMM dd, hh:mm a") : ""}
                        </p>
                      </div>
                      <span className="font-semibold">{formatCurrency(sale.netAmount)}</span>
                    </div>
                  ))
                )}
                <Button variant="outline" className="w-full" asChild>
                  <Link href="/dashboard/sales">View All Sales</Link>
                </Button>
              </CardContent>
            </Card>

            {/* Low Stock Alerts */}
            <Card>
              <CardHeader>
                <CardTitle>Low Stock Alerts</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {lowStock.length === 0 ? (
                  <p className="text-muted-foreground text-center">No low stock items</p>
                ) : (
                  lowStock.map((drug: any) => (
                    <div key={drug.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                      <div>
                        <p className="font-medium">{drug.name}</p>
                        <p className="text-sm text-muted-foreground">
                          Stock: {drug.stock} (Min: {drug.minStockLevel})
                        </p>
                      </div>
                      <Badge variant="destructive">Reorder</Badge>
                    </div>
                  ))
                )}
                <Button variant="outline" className="w-full" asChild>
                  <Link href="/dashboard/drugs?lowStock=true">View All Low Stock</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Second Row: Top Selling Drugs & Recent Activities */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Top Selling Drugs */}
          <Card>
            <CardHeader>
              <CardTitle>Top Selling Drugs</CardTitle>
            </CardHeader>
            <CardContent>
              {topDrugs.length === 0 ? (
                <p className="text-muted-foreground text-center">No data available</p>
              ) : (
                <div className="space-y-3">
                  {topDrugs.map((drug, idx) => (
                    <div key={drug.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-muted-foreground w-6">#{idx+1}</span>
                        <span className="font-medium">{drug.name}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-sm">{drug.total_quantity} units</p>
                        <p className="text-xs text-muted-foreground">{formatCurrency(drug.total_revenue)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Inventory Activities */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Inventory Activities</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentActivities.length === 0 ? (
                <p className="text-muted-foreground text-center">No recent activities</p>
              ) : (
                recentActivities.map((activity) => (
                  <div key={activity.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                    <div className="flex items-center gap-2">
                      {activity.type === "PURCHASE" && <Package className="h-4 w-4 text-green-500" />}
                      {activity.type === "SALE" && <ShoppingCart className="h-4 w-4 text-blue-500" />}
                      {activity.type === "ADJUSTMENT" && <AlertCircle className="h-4 w-4 text-yellow-500" />}
                      <div>
                        <p className="font-medium">{activity.drugName}</p>
                        <p className="text-xs text-muted-foreground">
                          {activity.type} • {activity.quantity > 0 ? `+${activity.quantity}` : activity.quantity} units
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {format(parseISO(activity.createdAt), "MMM dd, hh:mm a")}
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}