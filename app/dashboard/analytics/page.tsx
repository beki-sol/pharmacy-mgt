"use client";

import { useEffect, useState } from "react";
import { Header } from "@/app/components/dashboard/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/Card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/Tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/Select";
import { Button } from "@/app/components/ui/Button";
import { SalesChart } from "@/app/components/analytics/SalesChart";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/app/components/ui/Table";
import { Download } from "lucide-react";
import { formatCurrency } from "@/app/lib/utils";

export default function AnalyticsPage() {
  const [period, setPeriod] = useState("month");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

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

  const summaryCards = data ? [
    { title: "Total Sales", value: formatCurrency(data.summary?.totalSales || 0) },
    { title: "Transactions", value: data.summary?.totalTransactions || 0 },
    { title: "Average Ticket", value: formatCurrency(data.customerMetrics?.avg_transaction_value || 0) },
    { title: "Total Profit", value: formatCurrency(data.profitAnalysis?.reduce((acc: number, p: any) => acc + p.profit, 0) || 0) },
  ] : [];

  return (
    <>
      <Header
        title="Analytics"
        subtitle="Business insights and performance metrics"
        actions={
          <div className="flex items-center gap-2">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
                <SelectItem value="year">This Year</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm">
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          </div>
        }
      />
      <div className="p-6 space-y-6">
        {loading ? (
          <div className="flex justify-center p-12">Loading...</div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {summaryCards.map((card, i) => (
                <Card key={i}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">{card.value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Tabs defaultValue="sales" className="space-y-4">
              <TabsList>
                <TabsTrigger value="sales">Sales Trend</TabsTrigger>
                <TabsTrigger value="drugs">Top Drugs</TabsTrigger>
                <TabsTrigger value="staff">Staff Performance</TabsTrigger>
                <TabsTrigger value="categories">Categories</TabsTrigger>
              </TabsList>
              <TabsContent value="sales">
                <SalesChart data={data.salesTrend || []} />
              </TabsContent>
              <TabsContent value="drugs">
                <Card>
                  <CardHeader>
                    <CardTitle>Top Selling Drugs</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Drug</TableHead>
                          <TableHead>Quantity</TableHead>
                          <TableHead>Revenue</TableHead>
                          <TableHead>Profit Margin</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(data.topDrugs || []).map((drug: any) => (
                          <TableRow key={drug.id}>
                            <TableCell className="font-medium">{drug.name}</TableCell>
                            <TableCell>{drug.total_quantity}</TableCell>
                            <TableCell>{formatCurrency(drug.total_revenue)}</TableCell>
                            <TableCell>{drug.profit_margin?.toFixed(2)}%</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="staff">
                <Card>
                  <CardHeader>
                    <CardTitle>Staff Performance</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Staff</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Transactions</TableHead>
                          <TableHead>Total Sales</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(data.topStaff || []).map((staff: any) => (
                          <TableRow key={staff.id}>
                            <TableCell className="font-medium">{staff.name}</TableCell>
                            <TableCell>{staff.role}</TableCell>
                            <TableCell>{staff.transactions}</TableCell>
                            <TableCell>{formatCurrency(staff.total_sales)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="categories">
                <Card>
                  <CardHeader>
                    <CardTitle>Category Performance</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Category</TableHead>
                          <TableHead>Items Sold</TableHead>
                          <TableHead>Revenue</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(data.categoryPerformance || []).map((cat: any) => (
                          <TableRow key={cat.category}>
                            <TableCell className="font-medium">{cat.category}</TableCell>
                            <TableCell>{cat.quantity_sold}</TableCell>
                            <TableCell>{formatCurrency(cat.revenue)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </>
  );
}