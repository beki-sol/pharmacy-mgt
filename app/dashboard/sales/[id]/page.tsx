"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Header } from "@/app/components/dashboard/Header";
import { Button } from "@/app/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/Card";
import { Badge } from "@/app/components/ui/Badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/app/components/ui/alert-dialog";
import { Textarea } from "@/app/components/ui/Textarea";
import { Label } from "@/app/components/ui/Label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/Table";
import { Separator } from "@/app/components/ui/Separator";
import { formatCurrency, formatDate } from "@/app/lib/utils";
import { ArrowLeft, Printer, RotateCcw, AlertTriangle, Loader2 } from "lucide-react";
import toast from "react-hot-toast";

// Types (same as before)
interface SaleItem {
  id: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  tax: number;
  subtotal: number;
  drug: { name: string; genericName: string | null; unit: string };
  batch?: { batchNumber: string; expiryDate: string };
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
  const [refundDialogOpen, setRefundDialogOpen] = useState(false);
  const [refundReason, setRefundReason] = useState("");
  const [refunding, setRefunding] = useState(false);

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

  // Print handling
  const handlePrint = () => {
    window.print();
  };

  // Add print-specific CSS
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @media print {
        /* Hide everything except the receipt content */
        body * {
          visibility: hidden;
        }
        #receipt-content, #receipt-content * {
          visibility: visible;
        }
        #receipt-content {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          margin: 0;
          padding: 20px;
        }
        /* Hide action buttons in print */
        .no-print {
          display: none !important;
        }
        /* Ensure cards have borders */
        .card, .border {
          border: 1px solid #ccc !important;
          box-shadow: none !important;
        }
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "COMPLETED": return <Badge variant="success">Completed</Badge>;
      case "PENDING": return <Badge variant="warning">Pending</Badge>;
      case "CANCELLED": return <Badge variant="destructive">Cancelled</Badge>;
      case "REFUNDED": return <Badge variant="secondary">Refunded</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  const handleRefund = async () => {
    setRefunding(true);
    try {
      const res = await fetch(`/api/sales/${id}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: refundReason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Refund failed");
      toast.success("Refund processed successfully");
      setRefundDialogOpen(false);
      // Refresh sale data
      const updated = await fetch(`/api/sales/${id}`);
      const updatedData = await updated.json();
      setSale(updatedData);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setRefunding(false);
    }
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
      {/* Header and buttons (hidden in print) */}
      <div className="no-print">
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
                <Button variant="destructive" onClick={() => setRefundDialogOpen(true)}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Refund
                </Button>
              )}
            </div>
          }
        />
      </div>

      {/* Receipt content (visible in print) */}
      <div id="receipt-content" className="p-6 space-y-6">
        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Status</CardTitle>
            </CardHeader>
            <CardContent>{getStatusBadge(sale.status)}</CardContent>
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
              <p className="text-2xl font-bold text-destructive">
                -{formatCurrency(sale.discount)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Net Amount</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-600">
                {formatCurrency(sale.netAmount)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Customer & Payment Info */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Customer Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p>
                <span className="text-muted-foreground">Name:</span>{" "}
                {sale.customerName || "Guest"}
              </p>
              {sale.customerPhone && (
                <p>
                  <span className="text-muted-foreground">Phone:</span> {sale.customerPhone}
                </p>
              )}
              {sale.customerEmail && (
                <p>
                  <span className="text-muted-foreground">Email:</span> {sale.customerEmail}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Payment Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p>
                <span className="text-muted-foreground">Method:</span> {sale.paymentMethod}
              </p>
              <p>
                <span className="text-muted-foreground">Amount:</span>{" "}
                {formatCurrency(sale.netAmount)}
              </p>
              {sale.payments.map((p, idx) => (
                <p key={p.id} className="text-sm">
                  {idx === 0 ? "Paid" : "Partial"} {p.paidAt ? formatDate(p.paidAt) : ""} –{" "}
                  {p.status}
                </p>
              ))}
              {sale.notes && (
                <>
                  <Separator />
                  <p>
                    <span className="text-muted-foreground">Notes:</span> {sale.notes}
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Items Table */}
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
                        <p className="text-xs text-muted-foreground">
                          {item.drug.genericName}
                        </p>
                      )}
                      {item.batch && (
                        <p className="text-xs text-muted-foreground">
                          Batch: {item.batch.batchNumber} (Exp:{" "}
                          {formatDate(item.batch.expiryDate)})
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {item.quantity} {item.drug.unit}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(item.unitPrice)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(item.discount)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(item.subtotal)}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell colSpan={4} className="text-right font-medium">
                    Subtotal
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(sale.totalAmount)}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell colSpan={4} className="text-right font-medium">
                    Discount
                  </TableCell>
                  <TableCell className="text-right text-destructive">
                    -{formatCurrency(sale.discount)}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell colSpan={4} className="text-right font-medium">
                    Tax
                  </TableCell>
                  <TableCell className="text-right">{formatCurrency(sale.tax)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell colSpan={4} className="text-right font-bold">
                    Net Total
                  </TableCell>
                  <TableCell className="text-right font-bold">
                    {formatCurrency(sale.netAmount)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Prescription Info (if any) */}
        {sale.prescriptions.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Prescription</CardTitle>
            </CardHeader>
            <CardContent>
              {sale.prescriptions.map((rx) => (
                <div key={rx.id} className="space-y-2">
                  <p>
                    <span className="text-muted-foreground">Prescription #:</span>{" "}
                    {rx.prescriptionNumber}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Patient:</span> {rx.patientName}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Doctor:</span> {rx.doctorName}
                  </p>
                  {rx.diagnosis && (
                    <p>
                      <span className="text-muted-foreground">Diagnosis:</span> {rx.diagnosis}
                    </p>
                  )}
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

        {/* Staff Info */}
        <Card>
          <CardHeader>
            <CardTitle>Processed By</CardTitle>
          </CardHeader>
          <CardContent>
            <p>
              {sale.user.name} ({sale.user.email})
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Refund Dialog (hidden in print) */}
      <div className="no-print">
        <AlertDialog open={refundDialogOpen} onOpenChange={setRefundDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Process Refund</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to refund this sale? This will restore stock and batch
                quantities, and mark the sale as refunded.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-4">
              <Label htmlFor="reason">Reason (optional)</Label>
              <Textarea
                id="reason"
                placeholder="Enter reason for refund..."
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={refunding}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleRefund}
                disabled={refunding}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {refunding && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirm Refund
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </>
  );
}