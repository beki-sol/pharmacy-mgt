"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Header } from "@/app/components/dashboard/Header";
import { Button } from "@/app/components/ui/Button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/app/components/ui/Card";
import { CheckCircle, XCircle, Loader2, RefreshCw } from "lucide-react";
import { formatCurrency } from "@/app/lib/utils";
import toast from "react-hot-toast";

export default function SaleStatusPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const saleId = params.id as string;
  const urlTxRef = searchParams.get("tx_ref");

  const [sale, setSale] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");
  const [dbTxRef, setDbTxRef] = useState<string | null>(null);

  const fetchSale = async () => {
    try {
      const res = await fetch(`/api/sales/${saleId}`);
      if (!res.ok) throw new Error("Failed to fetch sale");
      const data = await res.json();
      setSale(data);
      // Extract tx_ref from the first payment if available
      const txRef = data.payments?.[0]?.chapaTxRef || null;
      setDbTxRef(txRef);
      return data;
    } catch (err: any) {
      setError(err.message);
      return null;
    }
  };

  const verifyPayment = async (txRef: string) => {
    setVerifying(true);
    try {
      const res = await fetch(`/api/payment/chapa/verify?tx_ref=${txRef}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Verification failed");
      toast.success("Payment verified!");
      await fetchSale(); // refresh sale data
    } catch (err: any) {
      console.error(err);
      toast.error(err.message);
      setError(err.message);
    } finally {
      setVerifying(false);
    }
  };

  // Initial load and auto-verify if we have a tx_ref and sale is pending
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      const currentSale = await fetchSale();
      const txRef = urlTxRef || dbTxRef;
      if (txRef && currentSale?.status === "PENDING") {
        await verifyPayment(txRef);
      }
      setLoading(false);
    };
    init();
  }, [saleId]);

  // Polling only if pending and not verifying
  useEffect(() => {
    if (!sale) return;
    if (sale.status === "PENDING" && !verifying) {
      const interval = setInterval(async () => {
        const updated = await fetchSale();
        if (updated?.status !== "PENDING") {
          clearInterval(interval);
        }
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [sale, verifying]);

  const activeTxRef = urlTxRef || dbTxRef;

  if (loading || verifying) {
    return (
      <>
        <Header title="Payment Status" />
        <div className="p-6 flex flex-col items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="mt-2">{verifying ? "Verifying payment..." : "Loading..."}</p>
          {activeTxRef && <p className="text-xs text-muted-foreground mt-1">Ref: {activeTxRef}</p>}
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
            <CardFooter className="flex gap-2">
              <Button variant="outline" asChild>
                <Link href="/dashboard/sales">Back to Sales</Link>
              </Button>
              {activeTxRef && (
                <Button onClick={() => verifyPayment(activeTxRef)} disabled={verifying}>
                  {verifying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                  Retry Verification
                </Button>
              )}
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
              {isPending && "If you have already paid, click 'Verify Now' to confirm."}
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
              <span className="text-muted-foreground">Status:</span>
              <span className="font-medium">{sale.status}</span>
            </div>
            {activeTxRef && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Transaction Ref:</span>
                <span className="font-mono text-xs truncate max-w-[180px]">{activeTxRef}</span>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex justify-center gap-2 flex-wrap">
            <Button variant="outline" asChild>
              <Link href="/dashboard/sales">View All Sales</Link>
            </Button>
            {isCompleted && (
              <Button asChild>
                <Link href={`/dashboard/sales/${sale.id}`}>View Receipt</Link>
              </Button>
            )}
            {isPending && (
              <Button onClick={() => verifyPayment(activeTxRef!)} disabled={verifying || !activeTxRef}>
                {verifying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                Verify Now
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