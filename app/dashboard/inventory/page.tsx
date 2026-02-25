"use client";

import { useEffect, useState } from "react";
import { Header } from "@/app/components/dashboard/Header";
import { Button } from "@/app/components/ui/Button";
import { Input } from "@/app/components/ui/Input";
import { Label } from "@/app/components/ui/Label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/app/components/ui/Table";
import { Badge } from "@/app/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/Card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/Tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Package, AlertTriangle, History, RefreshCw, Plus, Minus, Eye } from "lucide-react";
import { format } from "date-fns";
import { cn, formatCurrency, formatDate } from "@/app/lib/utils";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { Loader2 } from "lucide-react";

// Types
interface Drug {
  id: string;
  name: string;
  genericName: string;
  category: string;
  stock: number;
  minStockLevel: number;
  maxStockLevel: number;
  expiryDate: string | null;
  batches: Batch[];
}

interface Batch {
  id: string;
  batchNumber: string;
  expiryDate: string;
  quantity: number;
  remaining: number;
  costPrice: number;
}

interface InventoryLog {
  id: string;
  drugId: string;
  drugName: string;
  type: "PURCHASE" | "SALE" | "ADJUSTMENT" | "RETURN" | "DAMAGE" | "EXPIRED";
  quantity: number;
  previousStock: number;
  newStock: number;
  referenceType: string;
  referenceId: string;
  notes: string;
  createdAt: string;
  user: { name: string };
}

// Validation schema for stock adjustment
const adjustmentSchema = z.object({
  drugId: z.string().min(1, "Drug is required"),
  quantity: z.number().int().positive("Quantity must be positive"),
  type: z.enum(["ADJUSTMENT", "DAMAGE", "RETURN"]),
  notes: z.string().optional(),
});

type AdjustmentForm = z.infer<typeof adjustmentSchema>;

export default function InventoryPage() {
  const [activeTab, setActiveTab] = useState("overview");
  const [drugs, setDrugs] = useState<Drug[]>([]);
  const [logs, setLogs] = useState<InventoryLog[]>([]);
  const [expiringSoon, setExpiringSoon] = useState<Drug[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 0 });

  // Filters for overview
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [stockStatus, setStockStatus] = useState("");
  const [sortBy, setSortBy] = useState("name");
  const [sortOrder, setSortOrder] = useState("asc");

  // Dialog states
  const [isAdjustDialogOpen, setIsAdjustDialogOpen] = useState(false);
  const [selectedDrug, setSelectedDrug] = useState<Drug | null>(null);
  const [viewBatchDrug, setViewBatchDrug] = useState<Drug | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<AdjustmentForm>({
    resolver: zodResolver(adjustmentSchema),
  });

  const selectedDrugId = watch("drugId");

  // Fetch drugs with batches
  useEffect(() => {
    const fetchInventory = async () => {
      setLoading(true);
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        search,
        ...(category && { category }),
        ...(stockStatus === "low" && { lowStock: "true" }),
        ...(stockStatus === "out" && { outOfStock: "true" }),
        sortBy,
        sortOrder,
      });
      try {
        const res = await fetch(`/api/drugs?${params}`);
        const data = await res.json();
        setDrugs(data.drugs || []);
        setPagination(data.pagination || { page: 1, limit: 10, total: 0, pages: 0 });
      } catch (error) {
        console.error("Failed to fetch drugs", error);
        toast.error("Failed to load inventory");
      } finally {
        setLoading(false);
      }
    };
    fetchInventory();
  }, [pagination.page, search, category, stockStatus, sortBy, sortOrder]);

  // Fetch expiring soon drugs
  useEffect(() => {
    const fetchExpiring = async () => {
      try {
        const res = await fetch("/api/inventory/expiring");
        const data = await res.json();
        setExpiringSoon(data.drugs || []);
      } catch (error) {
        console.error("Failed to fetch expiring drugs", error);
      }
    };
    fetchExpiring();
  }, []);

  // Fetch inventory logs
  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const res = await fetch("/api/inventory/logs");
        const data = await res.json();
        setLogs(data.logs || []);
      } catch (error) {
        console.error("Failed to fetch logs", error);
      }
    };
    fetchLogs();
  }, []);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const clearFilters = () => {
    setSearch("");
    setCategory("");
    setStockStatus("");
    setSortBy("name");
    setSortOrder("asc");
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const getStockStatusBadge = (stock: number, min: number) => {
    if (stock === 0) return <Badge variant="destructive">Out of Stock</Badge>;
    if (stock <= min) return <Badge variant="warning">Low Stock</Badge>;
    return <Badge variant="success">In Stock</Badge>;
  };

  const getExpiryStatus = (expiryDate: string | null) => {
    if (!expiryDate) return <Badge variant="secondary">No Expiry</Badge>;
    const daysUntil = (new Date(expiryDate).getTime() - Date.now()) / (1000 * 3600 * 24);
    if (daysUntil < 0) return <Badge variant="destructive">Expired</Badge>;
    if (daysUntil < 30) return <Badge variant="warning">Expires Soon</Badge>;
    return <Badge variant="success">Valid</Badge>;
  };

  const handleAdjustSubmit = async (data: AdjustmentForm) => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/inventory/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Adjustment failed");
      toast.success("Stock adjusted successfully");
      setIsAdjustDialogOpen(false);
      reset();
      // Refresh data
      setPagination(prev => ({ ...prev, page: 1 }));
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const openAdjustDialog = (drug?: Drug) => {
    if (drug) {
      setValue("drugId", drug.id);
      setSelectedDrug(drug);
    } else {
      setSelectedDrug(null);
    }
    setIsAdjustDialogOpen(true);
  };

  return (
    <>
      <Header 
        title="Inventory Management" 
        subtitle="Track stock, batches, and expiry"
        actions={
          <Button onClick={() => openAdjustDialog()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Adjust Stock
          </Button>
        }
      />

      <div className="p-6 space-y-6">
        {/* Expiry Alerts */}
        {expiringSoon.length > 0 && (
          <Card className="border-yellow-200 bg-yellow-50">
            <CardContent className="p-4 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              <span className="text-sm text-yellow-800">
                {expiringSoon.length} drug(s) are expiring within 30 days. Please review.
              </span>
              <Button variant="link" className="ml-auto" onClick={() => setActiveTab("expiring")}>
                View
              </Button>
            </CardContent>
          </Card>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="batches">Batch Tracking</TabsTrigger>
            <TabsTrigger value="expiring">Expiry Monitoring</TabsTrigger>
            <TabsTrigger value="logs">Inventory Logs</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <Card>
              <CardContent className="p-4">
                <div className="grid gap-4 md:grid-cols-4">
                  <div className="space-y-2">
                    <Label>Search</Label>
                    <Input
                      placeholder="Drug name, generic..."
                      value={search}
                      onChange={handleSearch}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger>
                        <SelectValue placeholder="All Categories" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">All Categories</SelectItem>
                        <SelectItem value="PRESCRIPTION">Prescription</SelectItem>
                        <SelectItem value="OVER_THE_COUNTER">OTC</SelectItem>
                        <SelectItem value="CONTROLLED">Controlled</SelectItem>
                        <SelectItem value="SUPPLEMENTS">Supplements</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Stock Status</Label>
                    <Select value={stockStatus} onValueChange={setStockStatus}>
                      <SelectTrigger>
                        <SelectValue placeholder="All" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">All</SelectItem>
                        <SelectItem value="low">Low Stock</SelectItem>
                        <SelectItem value="out">Out of Stock</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Sort By</Label>
                    <Select value={`${sortBy}-${sortOrder}`} onValueChange={(val) => {
                      const [sb, so] = val.split("-");
                      setSortBy(sb);
                      setSortOrder(so);
                    }}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="name-asc">Name (A-Z)</SelectItem>
                        <SelectItem value="name-desc">Name (Z-A)</SelectItem>
                        <SelectItem value="stock-asc">Stock (Low-High)</SelectItem>
                        <SelectItem value="stock-desc">Stock (High-Low)</SelectItem>
                        <SelectItem value="expiryDate-asc">Expiry (Soonest)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex justify-end mt-4">
                  <Button variant="outline" size="sm" onClick={clearFilters}>
                    Clear Filters
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-0">
                {loading ? (
                  <div className="p-8 text-center">Loading...</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Drug</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Stock</TableHead>
                        <TableHead>Min/Max</TableHead>
                        <TableHead>Expiry</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {drugs.map((drug) => (
                        <TableRow key={drug.id}>
                          <TableCell className="font-medium">
                            <div>
                              {drug.name}
                              {drug.genericName && (
                                <p className="text-xs text-muted-foreground">{drug.genericName}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{drug.category.replace(/_/g, " ")}</TableCell>
                          <TableCell>{drug.stock}</TableCell>
                          <TableCell>{drug.minStockLevel} / {drug.maxStockLevel}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {drug.expiryDate ? formatDate(drug.expiryDate) : "—"}
                              {getExpiryStatus(drug.expiryDate)}
                            </div>
                          </TableCell>
                          <TableCell>{getStockStatusBadge(drug.stock, drug.minStockLevel)}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="icon" onClick={() => setViewBatchDrug(drug)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => openAdjustDialog(drug)}>
                              <RefreshCw className="h-4 w-4" />
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
          </TabsContent>

          {/* Batches Tab */}
          <TabsContent value="batches" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Batch Tracking</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {drugs.map((drug) => (
                    drug.batches && drug.batches.length > 0 && (
                      <div key={drug.id} className="border rounded-lg p-4">
                        <h3 className="font-semibold mb-2">{drug.name}</h3>
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
                            {drug.batches.map((batch) => (
                              <TableRow key={batch.id}>
                                <TableCell>{batch.batchNumber}</TableCell>
                                <TableCell>{formatDate(batch.expiryDate)}</TableCell>
                                <TableCell>{batch.quantity}</TableCell>
                                <TableCell>{batch.remaining}</TableCell>
                                <TableCell>{formatCurrency(batch.costPrice)}</TableCell>
                                <TableCell>{getExpiryStatus(batch.expiryDate)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Expiry Monitoring Tab */}
          <TabsContent value="expiring" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Expiry Monitoring</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Drug</TableHead>
                      <TableHead>Batch</TableHead>
                      <TableHead>Expiry Date</TableHead>
                      <TableHead>Days Left</TableHead>
                      <TableHead>Remaining</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {drugs.flatMap(drug => 
                      drug.batches?.map(batch => {
                        const daysLeft = Math.ceil((new Date(batch.expiryDate).getTime() - Date.now()) / (1000 * 3600 * 24));
                        if (daysLeft > 60) return null;
                        return (
                          <TableRow key={batch.id}>
                            <TableCell>{drug.name}</TableCell>
                            <TableCell>{batch.batchNumber}</TableCell>
                            <TableCell>{formatDate(batch.expiryDate)}</TableCell>
                            <TableCell>
                              <Badge variant={daysLeft < 0 ? "destructive" : daysLeft < 30 ? "warning" : "default"}>
                                {daysLeft < 0 ? "Expired" : `${daysLeft} days`}
                              </Badge>
                            </TableCell>
                            <TableCell>{batch.remaining}</TableCell>
                            <TableCell>
                              <Button variant="outline" size="sm">Mark as Damaged</Button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Inventory Logs Tab */}
          <TabsContent value="logs" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Inventory History</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Drug</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Previous</TableHead>
                      <TableHead>New</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>{formatDate(log.createdAt)}</TableCell>
                        <TableCell>{log.drugName}</TableCell>
                        <TableCell>
                          <Badge variant={
                            log.type === "PURCHASE" ? "success" :
                            log.type === "SALE" ? "default" :
                            log.type === "ADJUSTMENT" ? "warning" : "destructive"
                          }>
                            {log.type}
                          </Badge>
                        </TableCell>
                        <TableCell className={log.quantity > 0 ? "text-green-600" : "text-red-600"}>
                          {log.quantity > 0 ? `+${log.quantity}` : log.quantity}
                        </TableCell>
                        <TableCell>{log.previousStock}</TableCell>
                        <TableCell>{log.newStock}</TableCell>
                        <TableCell>{log.user?.name || "System"}</TableCell>
                        <TableCell className="max-w-xs truncate">{log.notes}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Batch Details Dialog */}
      <Dialog open={!!viewBatchDrug} onOpenChange={(open) => !open && setViewBatchDrug(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Batch Details - {viewBatchDrug?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
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
                {viewBatchDrug?.batches?.map((batch) => (
                  <TableRow key={batch.id}>
                    <TableCell>{batch.batchNumber}</TableCell>
                    <TableCell>{formatDate(batch.expiryDate)}</TableCell>
                    <TableCell>{batch.quantity}</TableCell>
                    <TableCell>{batch.remaining}</TableCell>
                    <TableCell>{formatCurrency(batch.costPrice)}</TableCell>
                    <TableCell>{getExpiryStatus(batch.expiryDate)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>

      {/* Stock Adjustment Dialog */}
      <Dialog open={isAdjustDialogOpen} onOpenChange={setIsAdjustDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Stock</DialogTitle>
            <DialogDescription>
              Add or remove stock manually. For purchases, use Purchase Orders.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(handleAdjustSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="drugId">Select Drug</Label>
              <Select
                onValueChange={(value) => {
                  setValue("drugId", value);
                  const drug = drugs.find(d => d.id === value);
                  setSelectedDrug(drug || null);
                }}
                defaultValue={selectedDrug?.id}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a drug" />
                </SelectTrigger>
                <SelectContent>
                  {drugs.map(drug => (
                    <SelectItem key={drug.id} value={drug.id}>
                      {drug.name} (Current: {drug.stock})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.drugId && <p className="text-sm text-destructive">{errors.drugId.message}</p>}
            </div>

            {selectedDrug && (
              <div className="text-sm bg-muted p-2 rounded">
                Current Stock: <span className="font-bold">{selectedDrug.stock}</span>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="type">Adjustment Type</Label>
              <Select onValueChange={(value) => setValue("type", value as any)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADJUSTMENT">Manual Adjustment</SelectItem>
                  <SelectItem value="DAMAGE">Damage/Waste</SelectItem>
                  <SelectItem value="RETURN">Return</SelectItem>
                </SelectContent>
              </Select>
              {errors.type && <p className="text-sm text-destructive">{errors.type.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity</Label>
              <Input
                id="quantity"
                type="number"
                {...register("quantity", { valueAsNumber: true })}
              />
              {errors.quantity && <p className="text-sm text-destructive">{errors.quantity.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Input id="notes" {...register("notes")} />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsAdjustDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Apply Adjustment
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}