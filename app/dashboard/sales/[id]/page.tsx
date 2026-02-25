"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Header } from "@/app/components/dashboard/Header";
import { Button } from "@/app/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/Card";
import { Badge } from "@/app/components/ui/Badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/Table";
import { formatCurrency, formatDateTime } from "@/app/lib/utils";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function SaleDetailPage() {
  const params = useParams();
  const router = useRouter();
  const saleId = params.id as string;

  const [sale, setSale] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSale = async () => {
      try {
        const res = await fetch(`/api/sales/${saleId}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setSale(data);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchSale();
  }, [saleId]);

  if (loading) {
    return (
      <>
        <Header title="Sale Details" />
        <div className="p-6 text-center">Loading...</div>
      </>
    );
  }

  if (!sale) {
    return (
      <>
        <Header title="Sale Details" />
        <div className="p-6 text-center">Sale not found</div>
      </>
    );
  }

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
      <Header title={`Sale ${sale.invoiceNumber}`} />
      <div className="p-6 space-y-6">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Sale Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Invoice:</span>
                <span className="font-medium">{sale.invoiceNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Date:</span>
                <span>{formatDateTime(sale.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status:</span>
                <span>{getStatusBadge(sale.status)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Payment Method:</span>
                <span>{sale.paymentMethod}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cashier:</span>
                <span>{sale.user?.name}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Customer Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Name:</span>
                <span>{sale.customerName || "Guest"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Phone:</span>
                <span>{sale.customerPhone || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Email:</span>
                <span>{sale.customerEmail || "—"}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Items</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Drug</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Unit Price</TableHead>
                  <TableHead>Discount</TableHead>
                  <TableHead>Subtotal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sale.saleItems?.map((item: any) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.drug?.name}</TableCell>
                    <TableCell>{item.quantity}</TableCell>
                    <TableCell>{formatCurrency(item.unitPrice)}</TableCell>
                    <TableCell>{formatCurrency(item.discount)}</TableCell>
                    <TableCell>{formatCurrency(item.subtotal)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Totals</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-w-sm">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>{formatCurrency(sale.totalAmount + sale.discount - sale.tax)}</span>
              </div>
              <div className="flex justify-between">
                <span>Discount:</span>
                <span>-{formatCurrency(sale.discount)}</span>
              </div>
              <div className="flex justify-between">
                <span>Tax:</span>
                <span>+{formatCurrency(sale.tax)}</span>
              </div>
              <div className="flex justify-between font-bold text-lg border-t pt-2">
                <span>Total:</span>
                <span>{formatCurrency(sale.netAmount)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}