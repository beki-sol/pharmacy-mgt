"use client";

import { useEffect, useState } from "react";
import { Header } from "@/app/components/dashboard/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/Card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/Table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/Select";
import { formatCurrency } from "@/app/lib/utils";

const formatNumber = (value: number): string => {
  return new Intl.NumberFormat().format(value);
};

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

  return (
    <>
      <Header title="Analytics" subtitle="Business performance insights" />
      <div className="p-6 space-y-6">
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

        <Card>
          <CardHeader>
            <CardTitle>Daily Sales Trend</CardTitle>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Top Selling Drugs</CardTitle>
            </CardHeader>
            <CardContent>
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
            </CardContent>
          </Card>

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

          <Card>
            <CardHeader>
              <CardTitle>Sales by Payment Method</CardTitle>
            </CardHeader>
            <CardContent>
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
            </CardContent>
          </Card>

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

          <Card>
            <CardHeader>
              <CardTitle>Category Performance</CardTitle>
            </CardHeader>
            <CardContent>
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
            </CardContent>
          </Card>

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

          <Card>
            <CardHeader>
              <CardTitle>Hourly Sales Pattern</CardTitle>
            </CardHeader>
            <CardContent>
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
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}