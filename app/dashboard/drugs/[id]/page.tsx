"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Header } from "@/app/components/dashboard/Header";
import { Button } from "@/app/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/Card";
import { Badge } from "@/app/components/ui/Badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/app/components/ui/Table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/Tabs";
import { formatCurrency, formatDate } from "@/app/lib/utils";
import { ArrowLeft, Edit, AlertTriangle, ShoppingCart, Plus, Loader2, CalendarIcon } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";
import { Input } from "@/app/components/ui/Input";
import { Label } from "@/app/components/ui/Label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/Select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/app/components/ui/Popover";
import { Calendar } from "@/app/components/ui/Calendar";
import { cn } from "@/app/lib/utils";
import { format } from "date-fns";

// Interfaces
interface Batch {
  id: string;
  batchNumber: string;
  expiryDate: string;
  quantity: number;
  remaining: number;
  costPrice: number;
}

interface Drug {
  id: string;
  name: string;
  genericName: string | null;
  brand: string | null;
  category: string | { name: string };
  dosage: string;
  unit: string;
  price: number;
  costPrice: number;
  stock: number;
  minStockLevel: number;
  maxStockLevel: number;
  reorderPoint: number;
  expiryDate: string | null;
  batchNumber: string | null;
  barcode: string | null;
  description: string | null;
  sideEffects: string | null;
  storageCondition: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  supplier: {
    id: string;
    name: string;
    company: string | null;
    phone: string | null;
    email: string | null;
  } | null;
  batches: Batch[];
}

// Helper functions
function getCategoryName(category: Drug['category']): string {
  if (!category) return '—';
  if (typeof category === 'string') return category.replace(/_/g, ' ');
  return category.name?.replace(/_/g, ' ') || '—';
}

function getEffectiveExpiryDate(drug: Drug): string | null {
  if (drug.batches && drug.batches.length > 0) {
    const validBatches = drug.batches.filter(b => b.remaining > 0);
    if (validBatches.length === 0) return null;
    const earliest = validBatches.reduce((earliest, batch) =>
      new Date(batch.expiryDate) < new Date(earliest.expiryDate) ? batch : earliest
    );
    return earliest.expiryDate;
  }
  return drug.expiryDate;
}

function getExpiryStatus(expiryDate: string | null) {
  if (!expiryDate) return { label: "No Expiry", variant: "secondary" };
  const daysUntil = (new Date(expiryDate).getTime() - Date.now()) / (1000 * 3600 * 24);
  if (daysUntil < 0) return { label: "Expired", variant: "destructive" };
  if (daysUntil < 30) return { label: "Expires Soon", variant: "warning" };
  return { label: "Valid", variant: "success" };
}

function getStockStatus(stock: number, min: number) {
  if (stock === 0) return { label: "Out of Stock", variant: "destructive" };
  if (stock <= min) return { label: "Low Stock", variant: "warning" };
  return { label: "In Stock", variant: "success" };
}

export default function DrugViewPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [drug, setDrug] = useState<Drug | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add to cart
  const [quantity, setQuantity] = useState(1);
  const [selectedBatchId, setSelectedBatchId] = useState("");

  // Add batch
  const [addBatchOpen, setAddBatchOpen] = useState(false);
  const [batchNumber, setBatchNumber] = useState("");
  const [batchExpiry, setBatchExpiry] = useState<Date>();
  const [batchQuantity, setBatchQuantity] = useState(1);
  const [batchCostPrice, setBatchCostPrice] = useState(0);
  const [addingBatch, setAddingBatch] = useState(false);

  useEffect(() => {
    const fetchDrug = async () => {
      try {
        const res = await fetch(`/api/drug/${id}`);
        if (!res.ok) throw new Error("Failed to load drug");
        const data = await res.json();
        setDrug(data);
      } catch (err: any) {
        setError(err.message);
        toast.error(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchDrug();
  }, [id]);

  const handleAddToCart = async () => {
    if (!drug) return;
    if (drug.batches.length > 0 && !selectedBatchId) {
      toast.error("Please select a batch");
      return;
    }
    if (quantity <= 0) {
      toast.error("Quantity must be positive");
      return;
    }

    const cartItem = {
      drugId: drug.id,
      name: drug.name,
      price: drug.price,
      quantity,
      unit: drug.unit,
      batchId: selectedBatchId || undefined,
      batchNumber: drug.batches.find(b => b.id === selectedBatchId)?.batchNumber,
    };

    try {
      const res = await fetch("/api/sales/drafts");
      const data = await res.json();
      let drafts = data.drafts || [];
      let cartDraft = drafts.find((d: any) => d.data.type === "cart");
      let items = cartDraft ? cartDraft.data.items : [];

      const existingIndex = items.findIndex((i: any) => i.drugId === drug.id && i.batchId === selectedBatchId);
      if (existingIndex >= 0) {
        items[existingIndex].quantity += quantity;
      } else {
        items.push(cartItem);
      }

      const updatedCart = {
        type: "cart",
        items,
        updatedAt: new Date().toISOString(),
      };

      const saveRes = await fetch("/api/sales/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: updatedCart }),
      });
      if (!saveRes.ok) throw new Error("Failed to save cart");
      toast.success("Added to cart");
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleAddBatch = async () => {
    if (!drug) return;
    if (!batchNumber || !batchExpiry || batchQuantity <= 0 || batchCostPrice <= 0) {
      toast.error("Please fill all batch fields");
      return;
    }
    setAddingBatch(true);
    try {
      const res = await fetch(`/api/drug/${id}/batches`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batchNumber,
          expiryDate: batchExpiry.toISOString(),
          quantity: batchQuantity,
          costPrice: batchCostPrice,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to add batch");
      }
      toast.success("Batch added");
      setAddBatchOpen(false);
      // Refresh drug data
      const refresh = await fetch(`/api/drug/${id}`);
      const refreshed = await refresh.json();
      setDrug(refreshed);
      // Reset form
      setBatchNumber("");
      setBatchExpiry(undefined);
      setBatchQuantity(1);
      setBatchCostPrice(0);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setAddingBatch(false);
    }
  };

  if (loading) {
    return (
      <>
        <Header title="Loading..." />
        <div className="p-6 flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </>
    );
  }

  if (error || !drug) {
    return (
      <>
        <Header title="Error" />
        <div className="p-6 text-center text-destructive">
          <AlertTriangle className="h-12 w-12 mx-auto mb-4" />
          <p>{error || "Drug not found"}</p>
          <Button className="mt-4" onClick={() => router.back()}>Go Back</Button>
        </div>
      </>
    );
  }

  const effectiveExpiryDate = getEffectiveExpiryDate(drug);
  const expiryStatus = getExpiryStatus(effectiveExpiryDate);
  const stockStatus = getStockStatus(drug.stock, drug.minStockLevel);
  const categoryName = getCategoryName(drug.category);

  return (
    <>
      <Header
        title={drug.name}
        subtitle={`${drug.genericName ? drug.genericName + ' · ' : ''}${categoryName}`}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => router.back()}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Back
            </Button>
            <Button variant="default" onClick={handleAddToCart}>
              <ShoppingCart className="mr-2 h-4 w-4" /> Add to Cart
            </Button>
            <Button asChild>
              <Link href={`/dashboard/drugs/${id}/edit`}>
                <Edit className="mr-2 h-4 w-4" /> Edit
              </Link>
            </Button>
           
              <Button variant="outline" onClick={() => setAddBatchOpen(true)}>
                <Plus className="mr-2 h-4 w-4" /> Add Batch
              </Button>
            
          </div>
        }
      />
      <div className="p-6 space-y-6">
        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Stock Status</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant={stockStatus.variant as any}>{stockStatus.label}</Badge>
              <p className="text-2xl font-bold mt-2">{drug.stock} {drug.unit}</p>
              <p className="text-xs text-muted-foreground">Min: {drug.minStockLevel}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Expiry</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant={expiryStatus.variant as any}>{expiryStatus.label}</Badge>
              <p className="text-lg font-medium mt-2">
                {effectiveExpiryDate ? formatDate(effectiveExpiryDate) : "—"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Selling Price</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatCurrency(drug.price)}</p>
              <p className="text-xs text-muted-foreground">Cost: {formatCurrency(drug.costPrice)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Reorder Point</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{drug.reorderPoint}</p>
              <p className="text-xs text-muted-foreground">Max stock: {drug.maxStockLevel}</p>
            </CardContent>
          </Card>
        </div>

        {/* Quantity and Batch Selector */}
        <Card>
          <CardHeader>
            <CardTitle>Add to Cart</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-2">
                <Label>Quantity</Label>
                <Input
                  type="number"
                  min={1}
                  max={drug.stock}
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                  className="w-24"
                />
              </div>
              {drug.batches.length > 0 && (
                <div className="space-y-2">
                  <Label>Select Batch</Label>
                  <Select value={selectedBatchId} onValueChange={setSelectedBatchId}>
                    <SelectTrigger className="w-64">
                      <SelectValue placeholder="Select batch" />
                    </SelectTrigger>
                    <SelectContent>
                      {drug.batches.map((batch) => (
                        <SelectItem key={batch.id} value={batch.id}>
                          {batch.batchNumber} (Exp: {formatDate(batch.expiryDate)}, Rem: {batch.remaining})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="details">
          <TabsList>
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="batches">Batches</TabsTrigger>
          </TabsList>
          <TabsContent value="details" className="space-y-4">
            <Card>
              <CardHeader><CardTitle>Basic Information</CardTitle></CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div><p className="text-sm text-muted-foreground">Name</p><p className="font-medium">{drug.name}</p></div>
                <div><p className="text-sm text-muted-foreground">Generic Name</p><p>{drug.genericName || "—"}</p></div>
                <div><p className="text-sm text-muted-foreground">Brand</p><p>{drug.brand || "—"}</p></div>
                <div><p className="text-sm text-muted-foreground">Category</p><p>{categoryName}</p></div>
                <div><p className="text-sm text-muted-foreground">Dosage</p><p>{drug.dosage}</p></div>
                <div><p className="text-sm text-muted-foreground">Unit</p><p>{drug.unit}</p></div>
                <div><p className="text-sm text-muted-foreground">Barcode</p><p>{drug.barcode || "—"}</p></div>
                <div><p className="text-sm text-muted-foreground">Batch Number</p><p>{drug.batchNumber || "—"}</p></div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Supplier Information</CardTitle></CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                {drug.supplier ? (
                  <>
                    <div><p className="text-sm text-muted-foreground">Name</p><p className="font-medium">{drug.supplier.name}</p></div>
                    <div><p className="text-sm text-muted-foreground">Company</p><p>{drug.supplier.company || "—"}</p></div>
                    <div><p className="text-sm text-muted-foreground">Phone</p><p>{drug.supplier.phone || "—"}</p></div>
                    <div><p className="text-sm text-muted-foreground">Email</p><p>{drug.supplier.email || "—"}</p></div>
                  </>
                ) : (
                  <p className="text-muted-foreground">No supplier assigned</p>
                )}
              </CardContent>
            </Card>
            {(drug.description || drug.sideEffects || drug.storageCondition) && (
              <Card>
                <CardHeader><CardTitle>Additional Information</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  {drug.description && <div><p className="text-sm text-muted-foreground">Description</p><p>{drug.description}</p></div>}
                  {drug.sideEffects && <div><p className="text-sm text-muted-foreground">Side Effects</p><p>{drug.sideEffects}</p></div>}
                  {drug.storageCondition && <div><p className="text-sm text-muted-foreground">Storage Conditions</p><p>{drug.storageCondition}</p></div>}
                </CardContent>
              </Card>
            )}
          </TabsContent>
          <TabsContent value="batches">
            <Card>
              <CardHeader><CardTitle>Batches</CardTitle></CardHeader>
              <CardContent>
                {drug.batches.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">No batches found</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Batch Number</TableHead>
                        <TableHead>Expiry Date</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead>Remaining</TableHead>
                        <TableHead>Cost Price</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {drug.batches.map((batch) => {
                        const batchExpiryStatus = getExpiryStatus(batch.expiryDate);
                        return (
                          <TableRow key={batch.id}>
                            <TableCell className="font-mono">{batch.batchNumber}</TableCell>
                            <TableCell>{formatDate(batch.expiryDate)}</TableCell>
                            <TableCell>{batch.quantity}</TableCell>
                            <TableCell>{batch.remaining}</TableCell>
                            <TableCell>{formatCurrency(batch.costPrice)}</TableCell>
                            <TableCell>
                              <Badge variant={batchExpiryStatus.variant as any}>
                                {batchExpiryStatus.label}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Add Batch Dialog */}
      <Dialog open={addBatchOpen} onOpenChange={setAddBatchOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Batch</DialogTitle>
            <DialogDescription>Enter batch details for {drug.name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Batch Number *</Label>
              <Input value={batchNumber} onChange={(e) => setBatchNumber(e.target.value)} />
            </div>
            <div>
              <Label>Expiry Date *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {batchExpiry ? format(batchExpiry, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar mode="single" selected={batchExpiry} onSelect={setBatchExpiry} initialFocus />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label>Quantity *</Label>
              <Input type="number" min={1} value={batchQuantity} onChange={(e) => setBatchQuantity(parseInt(e.target.value))} />
            </div>
            <div>
              <Label>Cost Price ($) *</Label>
              <Input type="number" step="0.01" min={0.01} value={batchCostPrice} onChange={(e) => setBatchCostPrice(parseFloat(e.target.value))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddBatchOpen(false)}>Cancel</Button>
            <Button onClick={handleAddBatch} disabled={addingBatch}>
              {addingBatch && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add Batch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}