"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Header } from "@/app/components/dashboard/Header";
import { Button } from "@/app/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/Card";
import { Badge } from "@/app/components/ui/Badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/Tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/Table";
import { formatCurrency, formatDate } from "@/app/lib/utils";
import { ArrowLeft, Edit, AlertTriangle, Package, ShoppingCart, CreditCard } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";

// Helper to get category name (handles both string and object)
function getCategoryName(category: any): string {
  if (!category) return "—";
  if (typeof category === "string") return category.replace(/_/g, " ");
  return category.name?.replace(/_/g, " ") || "—";
}

interface Drug {
  id: string;
  name: string;
  genericName: string | null;
  category: any; // can be string or object
  price: number;
  stock: number;
}

interface PurchaseOrder {
  id: string;
  orderNumber: string;
  totalAmount: number;
  status: string;
  orderDate: string;
  receivedDate: string | null;
  _count: { purchaseItems: number };
}

interface Payment {
  id: string;
  amount: number;
  method: string;
  status: string;
  createdAt: string;
}

interface Supplier {
  id: string;
  name: string;
  company: string | null;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  taxId: string | null;
  paymentTerms: string | null;
  creditLimit: number | null;
  balance: number;
  rating: number | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  drugs: Drug[];
  purchaseOrders: PurchaseOrder[];
  payments: Payment[];
  _count: {
    drugs: number;
    purchaseOrders: number;
    payments: number;
  };
}

export default function SupplierDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSupplier = async () => {
      try {
        const res = await fetch(`/api/suppliers/${id}`);
        if (!res.ok) {
          if (res.status === 404) throw new Error("Supplier not found");
          throw new Error("Failed to load supplier");
        }
        const data = await res.json();
        setSupplier(data);
      } catch (err: any) {
        setError(err.message);
        toast.error(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchSupplier();
  }, [id]);

  const getRatingStars = (rating: number | null) => {
    if (!rating) return "—";
    return "★".repeat(rating) + "☆".repeat(5 - rating);
  };

  if (loading) {
    return (
      <>
        <Header title="Loading Supplier..." />
        <div className="p-6 flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </>
    );
  }

  if (error || !supplier) {
    return (
      <>
        <Header title="Error" />
        <div className="p-6 text-center text-destructive">
          <AlertTriangle className="h-12 w-12 mx-auto mb-4" />
          <p>{error || "Supplier not found"}</p>
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
        title={supplier.name}
        subtitle={supplier.company || "Supplier"}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.back()}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <Button asChild>
              <Link href={`/dashboard/suppliers/${id}/edit`}>
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </Link>
            </Button>
          </div>
        }
      />
      <div className="p-6 space-y-6">
        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Balance</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatCurrency(supplier.balance)}</p>
              <p className="text-xs text-muted-foreground">
                Credit Limit: {supplier.creditLimit ? formatCurrency(supplier.creditLimit) : "—"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Rating</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{getRatingStars(supplier.rating)}</p>
              <p className="text-xs text-muted-foreground">Out of 5 stars</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Drugs Supplied</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{supplier._count.drugs}</p>
              <p className="text-xs text-muted-foreground">Active products</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Purchase Orders</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{supplier._count.purchaseOrders}</p>
              <p className="text-xs text-muted-foreground">Total orders</p>
            </CardContent>
          </Card>
        </div>

        {/* Contact Information */}
        <Card>
          <CardHeader>
            <CardTitle>Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm text-muted-foreground">Contact Person</p>
              <p className="font-medium">{supplier.contactPerson || "—"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Email</p>
              <p>{supplier.email || "—"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Phone</p>
              <p>{supplier.phone || "—"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Tax ID</p>
              <p>{supplier.taxId || "—"}</p>
            </div>
            <div className="md:col-span-2">
              <p className="text-sm text-muted-foreground">Address</p>
              <p>{supplier.address || "—"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Payment Terms</p>
              <p>{supplier.paymentTerms || "—"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <Badge variant={supplier.isActive ? "success" : "destructive"}>
                {supplier.isActive ? "Active" : "Inactive"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Notes */}
        {supplier.notes && (
          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p>{supplier.notes}</p>
            </CardContent>
          </Card>
        )}

        {/* Tabs for Drugs, Purchase Orders, Payments */}
        <Tabs defaultValue="drugs">
          <TabsList>
            <TabsTrigger value="drugs">Drugs Supplied</TabsTrigger>
            <TabsTrigger value="purchaseOrders">Purchase Orders</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
          </TabsList>

          <TabsContent value="drugs">
            <Card>
              <CardHeader>
                <CardTitle>Drugs from this Supplier</CardTitle>
              </CardHeader>
              <CardContent>
                {supplier.drugs.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">No drugs from this supplier</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Generic Name</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Price</TableHead>
                        <TableHead className="text-right">Stock</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {supplier.drugs.map((drug) => (
                        <TableRow key={drug.id}>
                          <TableCell className="font-medium">{drug.name}</TableCell>
                          <TableCell>{drug.genericName || "—"}</TableCell>
                          <TableCell>{getCategoryName(drug.category)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(drug.price)}</TableCell>
                          <TableCell className="text-right">{drug.stock}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="purchaseOrders">
            <Card>
              <CardHeader>
                <CardTitle>Recent Purchase Orders</CardTitle>
              </CardHeader>
              <CardContent>
                {supplier.purchaseOrders.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">No purchase orders</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Order #</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Items</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {supplier.purchaseOrders.map((po) => (
                        <TableRow key={po.id}>
                          <TableCell className="font-mono">{po.orderNumber}</TableCell>
                          <TableCell>{formatDate(po.orderDate)}</TableCell>
                          <TableCell className="text-right">{po._count.purchaseItems}</TableCell>
                          <TableCell className="text-right">{formatCurrency(po.totalAmount)}</TableCell>
                          <TableCell>
                            <Badge variant={
                              po.status === "DELIVERED" ? "success" :
                              po.status === "PENDING" ? "warning" :
                              po.status === "CANCELLED" ? "destructive" : "secondary"
                            }>
                              {po.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payments">
            <Card>
              <CardHeader>
                <CardTitle>Payment History</CardTitle>
              </CardHeader>
              <CardContent>
                {supplier.payments.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">No payment records</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {supplier.payments.map((payment) => (
                        <TableRow key={payment.id}>
                          <TableCell>{formatDate(payment.createdAt)}</TableCell>
                          <TableCell>{payment.method}</TableCell>
                          <TableCell className="text-right">{formatCurrency(payment.amount)}</TableCell>
                          <TableCell>
                            <Badge variant={payment.status === "COMPLETED" ? "success" : "warning"}>
                              {payment.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}