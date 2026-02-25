"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Header } from "@/app/components/dashboard/Header";
import { Button } from "@/app/components/ui/Button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/app/components/ui/Card";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { formatCurrency } from "@/app/lib/utils";

export default function SaleStatusPage() {
  const params = useParams();
  const router = useRouter();
  const saleId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [sale, setSale] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchSale = async () => {
      try {
        const res = await fetch(`/api/sales/${saleId}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load sale");
        setSale(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchSale();
  }, [saleId]);

  // Optional: poll every few seconds if status is still pending
  useEffect(() => {
    if (sale?.status === "PENDING") {
      const interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/sales/${saleId}`);
          const data = await res.json();
          if (data.status !== "PENDING") {
            setSale(data);
            clearInterval(interval);
          }
        } catch (err) {
          // ignore polling errors
        }
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [sale, saleId]);

  if (loading) {
    return (
      <>
        <Header title="Payment Status" />
        <div className="p-6 flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </>
    );
  }

  if (error || !sale) {
    return (
      <>
        <Header title="Payment Status" />
        <div className="p-6 max-w-md mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="text-destructive">Error</CardTitle>
              <CardDescription>{error || "Sale not found"}</CardDescription>
            </CardHeader>
            <CardFooter>
              <Button asChild>
                <Link href="/dashboard/sales">Back to Sales</Link>
              </Button>
            </CardFooter>
          </Card>
        </div>
      </>
    );
  }

  const isCompleted = sale.status === "COMPLETED";
  const isPending = sale.status === "PENDING";
  const isFailed = sale.status === "CANCELLED" || sale.status === "FAILED";

  return (
    <>
      <Header title="Payment Status" />
      <div className="p-6 max-w-md mx-auto">
        <Card>
          <CardHeader>
            <div className="flex justify-center mb-4">
              {isCompleted && <CheckCircle className="h-16 w-16 text-green-500" />}
              {isPending && <Loader2 className="h-16 w-16 animate-spin text-yellow-500" />}
              {isFailed && <XCircle className="h-16 w-16 text-destructive" />}
            </div>
            <CardTitle className="text-center">
              {isCompleted && "Payment Successful"}
              {isPending && "Processing Payment"}
              {isFailed && "Payment Failed"}
            </CardTitle>
            <CardDescription className="text-center">
              {isCompleted && "Your transaction has been completed successfully."}
              {isPending && "Please wait while we confirm your payment. This may take a few moments."}
              {isFailed && "There was an issue with your payment. Please try again."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Invoice:</span>
              <span className="font-medium">{sale.invoiceNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Amount:</span>
              <span className="font-medium">{formatCurrency(sale.netAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Payment Method:</span>
              <span className="font-medium">{sale.paymentMethod}</span>
            </div>
            {sale.paymentLink && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Chapa Reference:</span>
                <span className="font-medium text-xs truncate max-w-[150px]">{sale.payments?.[0]?.chapaTxRef}</span>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex justify-center gap-2">
            <Button variant="outline" asChild>
              <Link href="/dashboard/sales">View All Sales</Link>
            </Button>
            {isCompleted && (
              <Button asChild>
                <Link href={`/dashboard/sales/${sale.id}`}>View Receipt</Link>
              </Button>
            )}
            {isFailed && (
              <Button asChild>
                <Link href="/dashboard/sales/new">Try Again</Link>
              </Button>
            )}
          </CardFooter>
        </Card>
      </div>
    </>
  );
}