"use client";

import { useEffect, useState } from "react";
import { Header } from "@/app/components/dashboard/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/Card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/Table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/Select";
import { formatCurrency } from "@/app/lib/utils";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";

const formatNumber = (value: number): string => {
  return new Intl.NumberFormat().format(value);
};

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

interface AnalyticsData {
  summary: {
    totalSales: number;
    totalDiscount: number;
    totalTax: number;
    netSales: number;
    totalTransactions: number;
  };
  salesTrend: Array<{ date: Date; transactions: number; total_sales: number; net_sales: number; avg_ticket: number }>;
  topDrugs: Array<{
    id: string;
    name: string;
    genericName: string | null;
    brand: string | null;
    category: string;
    times_sold: number;
    total_quantity: number;
    total_revenue: number;
    avg_price: number;
  }>;
  topStaff: Array<{
    id: string;
    name: string;
    email: string;
    role: string;
    transactions: number;
    total_sales: number;
    net_sales: number;
  }>;
  inventoryStatus: Array<{
    category: string;
    total_items: number;
    total_stock: number;
    low_stock_items: number;
    out_of_stock_items: number;
    total_value: number;
  }>;
  salesByPayment: Array<{
    paymentMethod: string;
    transactions: number;
    total_amount: number;
    net_amount: number;
  }>;
  customerMetrics: {
    unique_customers: number | null;
    unique_emails: number | null;
    avg_transaction_value: number | null;
    max_transaction_value: number | null;
    min_transaction_value: number | null;
  };
  categoryPerformance: Array<{
    category: string;
    transactions: number;
    quantity_sold: number;
    revenue: number;
    avg_price: number;
  }>;
  profitAnalysis: Array<{
    id: string;
    name: string;
    category: string;
    quantity_sold: number;
    revenue: number;
    cost: number;
    profit: number;
    profit_margin: number;
  }>;
  hourlyPattern: Array<{ hour: number; transactions: number; total_sales: number }>;
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("month");

  useEffect(() => {
    const fetchAnalytics = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/analytics?period=${period}`);
        const json = await res.json();
        setData(json);
      } catch (error) {
        console.error("Failed to fetch analytics", error);
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, [period]);

  if (loading) return <div className="p-8 text-center">Loading analytics...</div>;
  if (!data) return <div className="p-8 text-center text-destructive">Failed to load analytics</div>;

  // Prepare data for charts
  const salesTrendData = data.salesTrend.map(item => ({
    date: new Date(item.date).toLocaleDateString(),
    total: item.total_sales,
    net: item.net_sales,
    transactions: item.transactions,
  }));

  const topDrugsData = data.topDrugs.slice(0, 10).map(drug => ({
    name: drug.name.length > 20 ? drug.name.substring(0, 20) + '…' : drug.name,
    quantity: drug.total_quantity,
    revenue: drug.total_revenue,
  }));

  const paymentData = data.salesByPayment.map(pm => ({
    name: pm.paymentMethod,
    value: pm.total_amount,
  }));

  const hourlyData = data.hourlyPattern.map(h => ({
    hour: `${h.hour}:00`,
    sales: h.total_sales,
    transactions: h.transactions,
  }));

  const categoryData = data.categoryPerformance.map(cat => ({
    name: cat.category.replace(/_/g, ' '),
    revenue: cat.revenue,
    quantity: cat.quantity_sold,
  }));

  return (
    <>
      <Header title="Analytics" subtitle="Business performance insights" />
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
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(data.summary.totalSales)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Net Sales</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(data.summary.netSales)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Transactions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatNumber(data.summary.totalTransactions)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Avg. Ticket</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {data.salesTrend.length > 0
                  ? formatCurrency(
                      data.salesTrend.reduce((acc, d) => acc + d.avg_ticket, 0) / data.salesTrend.length
                    )
                  : formatCurrency(0)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sales Trend Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Daily Sales Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={salesTrendData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis yAxisId="left" orientation="left" stroke="#8884d8" />
                <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" />
                <Tooltip formatter={(value) => formatCurrency(value as number)} />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="total" stroke="#8884d8" name="Total Sales" />
                <Line yAxisId="right" type="monotone" dataKey="net" stroke="#82ca9d" name="Net Sales" />
              </LineChart>
            </ResponsiveContainer>
            {/* Original table */}
            <div className="mt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Transactions</TableHead>
                    <TableHead className="text-right">Total Sales</TableHead>
                    <TableHead className="text-right">Net Sales</TableHead>
                    <TableHead className="text-right">Avg Ticket</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.salesTrend.map((row, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{new Date(row.date).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right">{formatNumber(row.transactions)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(row.total_sales)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(row.net_sales)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(row.avg_ticket)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Two‑column layout for charts + tables */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Top Drugs Chart + Table */}
          <Card>
            <CardHeader>
              <CardTitle>Top Selling Drugs</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={topDrugsData} layout="vertical" margin={{ left: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={150} />
                  <Tooltip formatter={(value) => formatNumber(value as number)} />
                  <Legend />
                  <Bar dataKey="quantity" fill="#8884d8" name="Quantity Sold" />
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead className="text-right">Qty Sold</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.topDrugs.map((drug) => (
                      <TableRow key={drug.id}>
                        <TableCell>
                          {drug.name}
                          {drug.genericName && <span className="text-xs text-muted-foreground ml-1">({drug.genericName})</span>}
                        </TableCell>
                        <TableCell className="text-right">{formatNumber(drug.total_quantity)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(drug.total_revenue)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Top Staff Table (no chart for staff) */}
          <Card>
            <CardHeader>
              <CardTitle>Top Performing Staff</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="text-right">Transactions</TableHead>
                    <TableHead className="text-right">Total Sales</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.topStaff.map((staff) => (
                    <TableRow key={staff.id}>
                      <TableCell>{staff.name}</TableCell>
                      <TableCell>{staff.role}</TableCell>
                      <TableCell className="text-right">{formatNumber(staff.transactions)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(staff.total_sales)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Sales by Payment Method Chart + Table */}
          <Card>
            <CardHeader>
              <CardTitle>Sales by Payment Method</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={paymentData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry) => entry.name}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {paymentData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(value as number)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Method</TableHead>
                      <TableHead className="text-right">Transactions</TableHead>
                      <TableHead className="text-right">Total Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.salesByPayment.map((pm) => (
                      <TableRow key={pm.paymentMethod}>
                        <TableCell>{pm.paymentMethod}</TableCell>
                        <TableCell className="text-right">{formatNumber(pm.transactions)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(pm.total_amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Inventory Status Table (no chart) */}
          <Card>
            <CardHeader>
              <CardTitle>Inventory Status by Category</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Items</TableHead>
                    <TableHead className="text-right">Total Stock</TableHead>
                    <TableHead className="text-right">Low Stock</TableHead>
                    <TableHead className="text-right">Out of Stock</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.inventoryStatus.map((item) => (
                    <TableRow key={item.category}>
                      <TableCell>{item.category.replace(/_/g, " ")}</TableCell>
                      <TableCell className="text-right">{formatNumber(item.total_items)}</TableCell>
                      <TableCell className="text-right">{formatNumber(item.total_stock)}</TableCell>
                      <TableCell className="text-right">{formatNumber(item.low_stock_items)}</TableCell>
                      <TableCell className="text-right">{formatNumber(item.out_of_stock_items)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.total_value)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Customer Metrics Card (no chart) */}
          <Card>
            <CardHeader>
              <CardTitle>Customer Metrics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span>Unique Customers (phone):</span>
                <span className="font-medium">{formatNumber(data.customerMetrics.unique_customers ?? 0)}</span>
              </div>
              <div className="flex justify-between">
                <span>Unique Emails:</span>
                <span className="font-medium">{formatNumber(data.customerMetrics.unique_emails ?? 0)}</span>
              </div>
              <div className="flex justify-between">
                <span>Avg Transaction Value:</span>
                <span className="font-medium">{formatCurrency(data.customerMetrics.avg_transaction_value ?? 0)}</span>
              </div>
              <div className="flex justify-between">
                <span>Max Transaction Value:</span>
                <span className="font-medium">{formatCurrency(data.customerMetrics.max_transaction_value ?? 0)}</span>
              </div>
              <div className="flex justify-between">
                <span>Min Transaction Value:</span>
                <span className="font-medium">{formatCurrency(data.customerMetrics.min_transaction_value ?? 0)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Category Performance Chart + Table */}
          <Card>
            <CardHeader>
              <CardTitle>Category Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={categoryData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis yAxisId="left" orientation="left" stroke="#8884d8" />
                  <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" />
                  <Tooltip formatter={(value, name) => 
                    name === 'revenue' ? formatCurrency(value as number) : formatNumber(value as number)
                  } />
                  <Legend />
                  <Bar yAxisId="left" dataKey="revenue" fill="#8884d8" name="Revenue" />
                  <Bar yAxisId="right" dataKey="quantity" fill="#82ca9d" name="Quantity Sold" />
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Transactions</TableHead>
                      <TableHead className="text-right">Qty Sold</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.categoryPerformance.map((cat) => (
                      <TableRow key={cat.category}>
                        <TableCell>{cat.category.replace(/_/g, " ")}</TableCell>
                        <TableCell className="text-right">{formatNumber(cat.transactions)}</TableCell>
                        <TableCell className="text-right">{formatNumber(cat.quantity_sold)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(cat.revenue)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Profit Analysis Table (no chart) */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Top Profit Drugs</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Drug</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Qty Sold</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead className="text-right">Profit</TableHead>
                    <TableHead className="text-right">Margin</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.profitAnalysis.map((drug) => (
                    <TableRow key={drug.id}>
                      <TableCell>{drug.name}</TableCell>
                      <TableCell>{drug.category.replace(/_/g, " ")}</TableCell>
                      <TableCell className="text-right">{formatNumber(drug.quantity_sold)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(drug.revenue)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(drug.cost)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(drug.profit)}</TableCell>
                      <TableCell className="text-right">
                        {drug.profit_margin != null ? Number(drug.profit_margin).toFixed(1) : '0.0'}%
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Hourly Pattern Chart + Table */}
          <Card>
            <CardHeader>
              <CardTitle>Hourly Sales Pattern</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={hourlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="hour" />
                  <YAxis yAxisId="left" orientation="left" stroke="#8884d8" />
                  <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" />
                  <Tooltip formatter={(value, name) => 
                    name === 'sales' ? formatCurrency(value as number) : formatNumber(value as number)
                  } />
                  <Legend />
                  <Bar yAxisId="left" dataKey="sales" fill="#8884d8" name="Sales" />
                  <Bar yAxisId="right" dataKey="transactions" fill="#82ca9d" name="Transactions" />
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Hour</TableHead>
                      <TableHead className="text-right">Transactions</TableHead>
                      <TableHead className="text-right">Total Sales</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.hourlyPattern.map((h) => (
                      <TableRow key={h.hour}>
                        <TableCell>{h.hour}:00</TableCell>
                        <TableCell className="text-right">{formatNumber(h.transactions)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(h.total_sales)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}