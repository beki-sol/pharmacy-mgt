"use client";

import { useEffect, useState } from "react";
import { Header } from "@/app/components/dashboard/Header";
import { Button } from "@/app/components/ui/Button";
import { Input } from "@/app/components/ui/Input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/app/components/ui/Table";
import { Badge } from "@/app/components/ui/Badge";
import { Card, CardContent } from "@/app/components/ui/Card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/Select";
import { Label } from "@/app/components/ui/Label";
import { Plus, Search, Eye } from "lucide-react";
import Link from "next/link";
import { formatCurrency, formatDate } from "@/app/lib/utils";
import { DatePickerWithRange } from "@/app/components/ui/data-range-picker";
import { addDays } from "date-fns";

export default function SalesPage() {
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 0 });

  // Filters
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: addDays(new Date(), -30),
    to: new Date(),
  });

  useEffect(() => {
    const fetchSales = async () => {
      setLoading(true);
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        search,
        ...(status && { status }),
        ...(paymentMethod && { paymentMethod }),
        ...(dateRange.from && { startDate: dateRange.from.toISOString() }),
        ...(dateRange.to && { endDate: dateRange.to.toISOString() }),
      });
      try {
        const res = await fetch(`/api/sales?${params}`);
        const data = await res.json();
        setSales(data.sales || []);
        setPagination(data.pagination || { page: 1, limit: 10, total: 0, pages: 0 });
      } catch (error) {
        console.error("Failed to fetch sales", error);
      } finally {
        setLoading(false);
      }
    };
    fetchSales();
  }, [pagination.page, search, status, paymentMethod, dateRange]);

  const clearFilters = () => {
    setSearch("");
    setStatus("");
    setPaymentMethod("");
    setDateRange({ from: addDays(new Date(), -30), to: new Date() });
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "COMPLETED": return <Badge variant="success">Completed</Badge>;
      case "PENDING": return <Badge variant="warning">Pending</Badge>;
      case "CANCELLED": return <Badge variant="destructive">Cancelled</Badge>;
      case "REFUNDED": return <Badge variant="secondary">Refunded</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  return (
    <>
      <Header 
        title="Sales" 
        subtitle="Manage your sales transactions"
        actions={
          <Button asChild>
            <Link href="/dashboard/sales/new">
              <Plus className="mr-2 h-4 w-4" />
              New Sale
            </Link>
          </Button>
        }
      />
      <div className="p-6 space-y-4">
        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <Label>Search</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Invoice, customer..."
                    className="pl-8"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All</SelectItem>
                    <SelectItem value="COMPLETED">Completed</SelectItem>
                    <SelectItem value="PENDING">Pending</SelectItem>
                    <SelectItem value="CANCELLED">Cancelled</SelectItem>
                    <SelectItem value="REFUNDED">Refunded</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Payment Method</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Methods" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All</SelectItem>
                    <SelectItem value="CASH">Cash</SelectItem>
                    <SelectItem value="CARD">Card</SelectItem>
                    <SelectItem value="CHAPA">Chapa</SelectItem>
                    <SelectItem value="INSURANCE">Insurance</SelectItem>
                    <SelectItem value="MIXED">Mixed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Date Range</Label>
                <DatePickerWithRange date={dateRange} setDate={setDateRange} />
              </div>
            </div>
            <div className="flex justify-end mt-4">
              <Button variant="outline" size="sm" onClick={clearFilters}>
                Clear Filters
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 text-center">Loading...</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sales.map((sale) => (
                    <TableRow key={sale.id}>
                      <TableCell className="font-medium">{sale.invoiceNumber}</TableCell>
                      <TableCell>{formatDate(sale.createdAt)}</TableCell>
                      <TableCell>{sale.customerName || "Guest"}</TableCell>
                      <TableCell>{formatCurrency(sale.netAmount)}</TableCell>
                      <TableCell>{sale.paymentMethod}</TableCell>
                      <TableCell>{getStatusBadge(sale.status)}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" asChild>
                          <Link href={`/dashboard/sales/${sale.id}`}>
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="flex justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page === 1}
              onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
            >
              Previous
            </Button>
            <span className="py-2 px-4 text-sm">
              Page {pagination.page} of {pagination.pages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page === pagination.pages}
              onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </>
  );
}