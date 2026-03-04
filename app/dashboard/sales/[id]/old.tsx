
/*
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Header } from "@/app/components/dashboard/Header";
import { Button } from "@/app/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/Card";
import { Badge } from "@/app/components/ui/Badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/Table";
import { Separator } from "@/app/components/ui/Separator";
import { formatCurrency, formatDate } from "@/app/lib/utils";
import { ArrowLeft, Printer, RotateCcw, AlertTriangle } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";

interface SaleItem {
  id: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  tax: number;
  subtotal: number;
  drug: { name: string; genericName: string | null; unit: string };
}

interface Payment {
  id: string;
  amount: number;
  method: string;
  status: string;
  paidAt: string | null;
}

interface Prescription {
  id: string;
  prescriptionNumber: string;
  patientName: string;
  doctorName: string;
  diagnosis: string | null;
  prescriptionItems: Array<{
    drug: { name: string };
    dosage: string;
    frequency: string;
    duration: string;
  }>;
}

interface Sale {
  id: string;
  invoiceNumber: string;
  createdAt: string;
  customerName: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  totalAmount: number;
  discount: number;
  tax: number;
  netAmount: number;
  paymentMethod: string;
  status: "COMPLETED" | "PENDING" | "CANCELLED" | "REFUNDED";
  notes: string | null;
  user: { name: string; email: string };
  saleItems: SaleItem[];
  payments: Payment[];
  prescriptions: Prescription[];
}

export default function SaleDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [sale, setSale] = useState<Sale | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSale = async () => {
      try {
        const res = await fetch(`/api/sales/${id}`);
        if (!res.ok) {
          if (res.status === 404) throw new Error("Sale not found");
          throw new Error("Failed to load sale");
        }
        const data = await res.json();
        setSale(data);
      } catch (err: any) {
        setError(err.message);
        toast.error(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchSale();
  }, [id]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "COMPLETED": return <Badge variant="success">Completed</Badge>;
      case "PENDING": return <Badge variant="warning">Pending</Badge>;
      case "CANCELLED": return <Badge variant="destructive">Cancelled</Badge>;
      case "REFUNDED": return <Badge variant="secondary">Refunded</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <>
        <Header title="Loading Sale..." />
        <div className="p-6 flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </>
    );
  }

  if (error || !sale) {
    return (
      <>
        <Header title="Error" />
        <div className="p-6 text-center text-destructive">
          <AlertTriangle className="h-12 w-12 mx-auto mb-4" />
          <p>{error || "Sale not found"}</p>
          <Button className="mt-4" onClick={() => router.back()}>
            Go Back
          </Button>
        </div>
      </>
    );
  }

  return (
    <>
      <Header
        title={`Sale ${sale.invoiceNumber}`}
        subtitle={`Processed on ${formatDate(sale.createdAt)}`}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.back()}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="mr-2 h-4 w-4" />
              Print
            </Button>
            {sale.status === "COMPLETED" && (
              <Button variant="destructive">
                <RotateCcw className="mr-2 h-4 w-4" />
                Refund
              </Button>
            )}
          </div>
        }
      />
      <div className="p-6 space-y-6">
      
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Status</CardTitle>
            </CardHeader>
            <CardContent>
              {getStatusBadge(sale.status)}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Amount</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatCurrency(sale.totalAmount)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Discount</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-destructive">-{formatCurrency(sale.discount)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Net Amount</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(sale.netAmount)}</p>
            </CardContent>
          </Card>
        </div>

       
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Customer Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p><span className="text-muted-foreground">Name:</span> {sale.customerName || "Guest"}</p>
              {sale.customerPhone && <p><span className="text-muted-foreground">Phone:</span> {sale.customerPhone}</p>}
              {sale.customerEmail && <p><span className="text-muted-foreground">Email:</span> {sale.customerEmail}</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Payment Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p><span className="text-muted-foreground">Method:</span> {sale.paymentMethod}</p>
              <p><span className="text-muted-foreground">Amount:</span> {formatCurrency(sale.netAmount)}</p>
              {sale.payments.map((p, idx) => (
                
                <p key={p.id} className="text-sm">
                  {idx === 0 ? "Paid" : "Partial"}{" "}
                      {p.paidAt ? formatDate(p.paidAt) : "Not paid yet"} – {p.status}
                </p>
              ))}
              {sale.notes && (
                <>
                  <Separator />
                  <p><span className="text-muted-foreground">Notes:</span> {sale.notes}</p>
                </>
              )}
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
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead className="text-right">Discount</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sale.saleItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      {item.drug.name}
                      {item.drug.genericName && (
                        <p className="text-xs text-muted-foreground">{item.drug.genericName}</p>
                      )}
                    </TableCell>
                    <TableCell className="text-right">{item.quantity} {item.drug.unit}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.unitPrice)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.discount)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.subtotal)}</TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell colSpan={4} className="text-right font-medium">Subtotal</TableCell>
                  <TableCell className="text-right">{formatCurrency(sale.totalAmount)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell colSpan={4} className="text-right font-medium">Discount</TableCell>
                  <TableCell className="text-right text-destructive">-{formatCurrency(sale.discount)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell colSpan={4} className="text-right font-medium">Tax</TableCell>
                  <TableCell className="text-right">{formatCurrency(sale.tax)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell colSpan={4} className="text-right font-bold">Net Total</TableCell>
                  <TableCell className="text-right font-bold">{formatCurrency(sale.netAmount)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>

       
        {sale.prescriptions.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Prescription</CardTitle>
            </CardHeader>
            <CardContent>
              {sale.prescriptions.map((rx) => (
                <div key={rx.id} className="space-y-2">
                  <p><span className="text-muted-foreground">Prescription #:</span> {rx.prescriptionNumber}</p>
                  <p><span className="text-muted-foreground">Patient:</span> {rx.patientName}</p>
                  <p><span className="text-muted-foreground">Doctor:</span> {rx.doctorName}</p>
                  {rx.diagnosis && <p><span className="text-muted-foreground">Diagnosis:</span> {rx.diagnosis}</p>}
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Drug</TableHead>
                        <TableHead>Dosage</TableHead>
                        <TableHead>Frequency</TableHead>
                        <TableHead>Duration</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rx.prescriptionItems.map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell>{item.drug.name}</TableCell>
                          <TableCell>{item.dosage}</TableCell>
                          <TableCell>{item.frequency}</TableCell>
                          <TableCell>{item.duration}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Processed By</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{sale.user.name} ({sale.user.email})</p>
          </CardContent>
        </Card>
      </div>
    </>
  );
} */