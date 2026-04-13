"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/Card";
import { Header } from "@/app/components/dashboard/Header";
import {
  DollarSign,
  ShoppingCart,
  Users,
  Package,
  TrendingUp,
  TrendingDown,
  Plus,
  AlertCircle,
} from "lucide-react";
import { Badge } from "@/app/components/ui/Badge";
import { Button } from "@/app/components/ui/Button";
import Link from "next/link";
import { formatCurrency } from "@/app/lib/utils";
import { format, parseISO } from "date-fns";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/Select";
import { useRouter } from "next/navigation";

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

interface PaymentMethodData {
  name: string;
  value: number;
}

interface CategoryData {
  name: string;
  revenue: number;
}

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8", "#82CA9D"];

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentSales, setRecentSales] = useState<RecentSale[]>([]);
  const [salesTrend, setSalesTrend] = useState<SalesTrend[]>([]);
  const [lowStock, setLowStock] = useState<any[]>([]);
  const [topDrugs, setTopDrugs] = useState<TopDrug[]>([]);
  const [recentActivities, setRecentActivities] = useState<InventoryActivity[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodData[]>([]);
  const [categoryPerformance, setCategoryPerformance] = useState<CategoryData[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("month");

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [statsRes, salesRes, lowStockRes, activitiesRes] = await Promise.all([
          fetch(`/api/analytics?period=${period}`),
          fetch("/api/sales?limit=5&sortBy=createdAt&sortOrder=desc"),
          fetch("/api/drug?lowStock=true&limit=5"),
          fetch("/api/inventory/logs?limit=5"),
        ]);

        const statsData = await statsRes.json();
        const salesData = await salesRes.json();
        const lowStockData = await lowStockRes.json();
        const activitiesData = await activitiesRes.json();

        // Debug: log payment data
        console.log("Payment data from API:", statsData.salesByPayment);

        // Extract stats
        setStats({
          totalSales: statsData.summary?.totalSales || 0,
          totalTransactions: statsData.summary?.totalTransactions || 0,
          averageTicket: statsData.customerMetrics?.avg_transaction_value || 0,
          totalProfit: statsData.profitAnalysis?.reduce((acc: number, p: any) => acc + p.profit, 0) || 0,
          inventoryValue: statsData.summary?.inventoryValue || 0,
          lowStockItems: statsData.inventoryStatus?.reduce((acc: number, i: any) => acc + i.low_stock_items, 0) || 0,
        });

        setRecentSales(salesData.sales || []);
        setLowStock(lowStockData.alerts?.lowStock || []);
        setTopDrugs(statsData.topDrugs?.slice(0, 5) || []);
        setRecentActivities(activitiesData.logs || []);

        // Prepare payment method data
        const paymentData = (statsData.salesByPayment || []).map((item: any) => ({
          name: item.paymentMethod,
          value: item.total_amount,
        }));
        setPaymentMethods(paymentData);

        // Prepare category performance data
        const categoryData = (statsData.categoryPerformance || []).map((item: any) => ({
          name: item.category?.replace(/_/g, " ") || "Other",
          revenue: item.revenue,
        }));
        setCategoryPerformance(categoryData.slice(0, 5));

        // Process sales trend – map `total_sales` to `sales`
        const trend = (statsData.salesTrend || []).map((item: any) => {
          let dateObj: Date;
          if (item.date instanceof Date) {
            dateObj = item.date;
          } else if (typeof item.date === "string") {
            dateObj = parseISO(item.date);
          } else {
            dateObj = new Date();
          }
          return {
            date: isNaN(dateObj.getTime()) ? "Invalid" : format(dateObj, "MMM dd"),
            sales: item.total_sales || 0,
            transactions: item.transactions || 0,
          };
        });
        setSalesTrend(trend);
      } catch (error) {
        console.error("Failed to fetch dashboard data", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [period]);

  // Handle click on sales trend chart point
  const handleTrendPointClick = (data: any) => {
    if (data && data.activeLabel) {
      console.log("Clicked on date:", data.activeLabel);
      alert(`You clicked on ${data.activeLabel}. Implement navigation to detailed report.`);
    }
  };

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

  const summaryCards = stats
    ? [
        { title: "Total Sales", value: formatCurrency(stats.totalSales), change: "+12.5%", trend: "up", icon: DollarSign },
        { title: "Transactions", value: stats.totalTransactions.toLocaleString(), change: "+8.3%", trend: "up", icon: ShoppingCart },
        { title: "Avg Ticket", value: formatCurrency(stats.averageTicket), change: "+4.2%", trend: "up", icon: Users },
        { title: "Total Profit", value: formatCurrency(stats.totalProfit), change: "+15.1%", trend: "up", icon: TrendingUp },
        { title: "Inventory Value", value: formatCurrency(stats.inventoryValue), change: "-2.3%", trend: "down", icon: Package },
        { title: "Low Stock", value: stats.lowStockItems.toString(), change: "+2", trend: "up", icon: Package },
      ]
    : [];

  return (
    <>
      <Header title="Dashboard" subtitle="Welcome back, Admin" showSearch />
      <div className="p-6 space-y-6">
        {/* Period Selector */}
        <div className="flex justify-end">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">Last 7 days</SelectItem>
              <SelectItem value="month">Last 30 days</SelectItem>
              <SelectItem value="year">Last 12 months</SelectItem>
            </SelectContent>
          </Select>
        </div>

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
              <Plus className="mr-2 h-5 w-5" /> New Sale
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-auto py-4">
            <Link href="/dashboard/drugs/new">
              <Plus className="mr-2 h-5 w-5" /> Add Drug
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-auto py-4">
            <Link href="/dashboard/inventory">
              <Package className="mr-2 h-5 w-5" /> Manage Stock
            </Link>
          </Button>
          <Button asChild variant="outline" className="h-auto py-4">
            <Link href="/dashboard/reports">
              <TrendingUp className="mr-2 h-5 w-5" /> View Reports
            </Link>
          </Button>
        </div>

        {/* Charts Row */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Sales Trend Chart (Area Chart) */}
          <Card>
            <CardHeader>
              <CardTitle>Sales Trend</CardTitle>
            </CardHeader>
            <CardContent>
              {salesTrend.length === 0 ? (
                <p className="text-center text-muted-foreground">No sales data for selected period</p>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart
                    data={salesTrend}
                    margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                    onClick={handleTrendPointClick}
                  >
                    <defs>
                      <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#8884d8" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis tickFormatter={(value) => `$${value}`} />
                    <Tooltip formatter={(value) => formatCurrency(value as number)} />
                    <Area
                      type="monotone"
                      dataKey="sales"
                      stroke="#8884d8"
                      fillOpacity={1}
                      fill="url(#colorSales)"
                      activeDot={{ onClick: (e, payload) => handleTrendPointClick(payload) }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Payment Methods Pie Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Sales by Payment Method</CardTitle>
            </CardHeader>
            <CardContent>
              {paymentMethods.length === 0 ? (
                <p className="text-center text-muted-foreground">No payment data available</p>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={paymentMethods}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => {
                        const percentage = percent ? (percent * 100).toFixed(0) : "0";
                        return `${name}: ${percentage}%`;
                      }}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {paymentMethods.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrency(value as number)} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Second Row of Charts */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Top Selling Drugs Bar Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Top Selling Drugs (Units)</CardTitle>
            </CardHeader>
            <CardContent>
              {topDrugs.length === 0 ? (
                <p className="text-center text-muted-foreground">No data available</p>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={topDrugs} layout="vertical" margin={{ left: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={100} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="total_quantity" fill="#82ca9d" name="Units Sold" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Category Performance Bar Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Revenue by Category</CardTitle>
            </CardHeader>
            <CardContent>
              {categoryPerformance.length === 0 ? (
                <p className="text-center text-muted-foreground">No data available</p>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={categoryPerformance} layout="vertical" margin={{ left: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" tickFormatter={(value) => formatCurrency(value)} />
                    <YAxis dataKey="name" type="category" width={100} />
                    <Tooltip formatter={(value) => formatCurrency(value as number)} />
                    <Bar dataKey="revenue" fill="#8884d8" name="Revenue" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Third Row: Recent Sales & Low Stock */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
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
          </div>
          <div>
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

        {/* Fourth Row: Top Selling Drugs (Revenue) & Recent Activities */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Top Selling Drugs (Revenue)</CardTitle>
            </CardHeader>
            <CardContent>
              {topDrugs.length === 0 ? (
                <p className="text-muted-foreground text-center">No data available</p>
              ) : (
                <div className="space-y-3">
                  {topDrugs.map((drug, idx) => (
                    <div key={drug.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-muted-foreground w-6">#{idx + 1}</span>
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