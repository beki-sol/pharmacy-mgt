"use client";

import { useState } from "react";
import { Header } from "@/app/components/dashboard/Header";
import { Button } from "@/app/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/Card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/Select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/Tabs";
import { DatePickerWithRange } from "@/app/components/ui/data-range-picker";
import { Download } from "lucide-react";
import { formatCurrency } from "@/app/lib/utils";
import { addDays } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/Table";

export default function ReportsPage() {
  const [reportType, setReportType] = useState("sales");
  const [lossValuation, setLossValuation] = useState("cost");
  const [period, setPeriod] = useState("month");
  const [dateRange, setDateRange] = useState({ from: addDays(new Date(), -30), to: new Date() });
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const generateReport = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        type: reportType,
        period,
        startDate: dateRange.from.toISOString(),
        endDate: dateRange.to.toISOString(),
        ...(reportType === "profit-drug" && { lossValuation }),
      });
      const res = await fetch(`/api/reports?${params}`);
      const json = await res.json();
      setData(json);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = () => {
    const params = new URLSearchParams({
      type: reportType,
      startDate: dateRange.from.toISOString(),
      endDate: dateRange.to.toISOString(),
      ...(reportType === "profit-drug" && { lossValuation }),
    });
    window.open(`/api/reports/export/csv?${params}`, "_blank");
  };

  return (
    <>
      <Header
        title="Reports"
        subtitle="Generate and export business reports"
        actions={
          <Button variant="outline" onClick={exportCSV} disabled={!data}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        }
      />
      <div className="p-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Report Parameters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">Report Type</label>
                <Select value={reportType} onValueChange={setReportType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sales">Sales Report</SelectItem>
                    <SelectItem value="inventory">Inventory Valuation</SelectItem>
                    <SelectItem value="profit-drug">Profit & Loss (Drugs + Losses)</SelectItem>
                    <SelectItem value="profit-full">Profit & Loss (Full)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {reportType === "profit-drug" && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Loss Valuation</label>
                  <Select value={lossValuation} onValueChange={setLossValuation}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cost">Cost Price</SelectItem>
                      <SelectItem value="selling">Selling Price</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <label className="text-sm font-medium">Date Range</label>
                <DatePickerWithRange date={dateRange} setDate={setDateRange} />
              </div>
            </div>
            <Button onClick={generateReport} className="mt-4" disabled={loading}>
              Generate Report
            </Button>
          </CardContent>
        </Card>

        {data && (
          <Card>
            <CardHeader>
              <CardTitle>
                {reportType === "sales" && "Sales Report"}
                {reportType === "inventory" && "Inventory Report"}
                {reportType === "profit-drug" && "Profit & Loss (Drugs + Losses)"}
                {reportType === "profit-full" && "Profit & Loss (Full)"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {reportType === "sales" && (
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="border p-4 rounded"><p className="text-sm text-muted-foreground">Total Sales</p><p className="text-2xl font-bold">{formatCurrency(data.total || 0)}</p></div>
                    <div className="border p-4 rounded"><p className="text-sm text-muted-foreground">Transactions</p><p className="text-2xl font-bold">{data.count || 0}</p></div>
                    <div className="border p-4 rounded"><p className="text-sm text-muted-foreground">Average Ticket</p><p className="text-2xl font-bold">{data.count ? formatCurrency(data.total / data.count) : formatCurrency(0)}</p></div>
                  </div>
                  <Table>
                    <TableHeader><TableRow><TableHead>Invoice</TableHead><TableHead>Date</TableHead><TableHead>Customer</TableHead><TableHead>Amount</TableHead><TableHead>Payment</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {data.sales?.slice(0, 10).map((sale: any) => (
                        <TableRow key={sale.id}><TableCell>{sale.invoiceNumber}</TableCell><TableCell>{new Date(sale.createdAt).toLocaleDateString()}</TableCell><TableCell>{sale.customerName || "Guest"}</TableCell><TableCell>{formatCurrency(sale.netAmount)}</TableCell><TableCell>{sale.paymentMethod}</TableCell></TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              {reportType === "inventory" && (
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="border p-4 rounded"><p className="text-sm text-muted-foreground">Total Inventory Value</p><p className="text-2xl font-bold">{formatCurrency(data.totalValue || 0)}</p></div>
                    <div className="border p-4 rounded"><p className="text-sm text-muted-foreground">Low Stock Items</p><p className="text-2xl font-bold">{data.lowStockCount || 0}</p></div>
                  </div>
                  <h3 className="font-semibold">Expiring Soon</h3>
                  <Table>
                    <TableHeader><TableRow><TableHead>Drug</TableHead><TableHead>Batch</TableHead><TableHead>Expiry</TableHead><TableHead>Remaining</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {data.expiring?.map((item: any) => (
                        <TableRow key={item.id}><TableCell>{item.drug?.name}</TableCell><TableCell>{item.batchNumber}</TableCell><TableCell>{new Date(item.expiryDate).toLocaleDateString()}</TableCell><TableCell>{item.remaining}</TableCell></TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              {(reportType === "profit-drug" || reportType === "profit-full") && (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="border p-4 rounded"><p className="text-sm text-muted-foreground">Revenue</p><p className="text-2xl font-bold text-green-600">{formatCurrency(data.revenue || 0)}</p></div>
                  <div className="border p-4 rounded"><p className="text-sm text-muted-foreground">Cost of Goods Sold</p><p className="text-2xl font-bold text-red-600">{formatCurrency(data.cogs || 0)}</p></div>
                  <div className="border p-4 rounded"><p className="text-sm text-muted-foreground">Gross Profit</p><p className="text-2xl font-bold text-blue-600">{formatCurrency(data.grossProfit || 0)}</p></div>
                  {reportType === "profit-drug" && (
                    <div className="border p-4 rounded"><p className="text-sm text-muted-foreground">Inventory Losses (Valuation: {data.lossValuationUsed})</p><p className="text-2xl font-bold text-orange-600">{formatCurrency(data.totalLosses || 0)}</p></div>
                  )}
                  {reportType === "profit-full" && (
                    <>
                      <div className="border p-4 rounded"><p className="text-sm text-muted-foreground">Inventory Losses</p><p className="text-2xl font-bold text-orange-600">{formatCurrency(data.totalLosses || 0)}</p></div>
                      <div className="border p-4 rounded"><p className="text-sm text-muted-foreground">Operating Expenses</p><p className="text-2xl font-bold text-purple-600">{formatCurrency(data.totalExpenses || 0)}</p></div>
                    </>
                  )}
                  <div className="border p-4 rounded md:col-span-2"><p className="text-sm text-muted-foreground">Net Profit</p><p className="text-2xl font-bold">{formatCurrency(data.netProfit || 0)}</p></div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}