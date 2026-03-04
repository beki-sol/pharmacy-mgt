"use client";

import { useEffect, useState } from "react";
import { Header } from "@/app/components/dashboard/Header";
import { Button } from "@/app/components/ui/Button";
import { Input } from "@/app/components/ui/Input";
import { Label } from "@/app/components/ui/Label";
import { Textarea } from "@/app/components/ui/Textarea";
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
} from "@/app/components/ui/Select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/app/components/ui/dialog";
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
import { formatCurrency, formatDate } from "@/app/lib/utils";
import { Package, AlertTriangle, History, RefreshCw, Plus, Minus, Eye, Loader2 } from "lucide-react";
import toast from "react-hot-toast";

// Types
interface Drug {
  id: string;
  name: string;
  genericName: string | null;
  category: string;
  stock: number;
  minStockLevel: number;
  maxStockLevel: number;
  expiryDate: string | null;
  unit: string;
  batches?: Batch[];
}

interface Batch {
  id: string;
  batchNumber: string;
  expiryDate: string;
  quantity: number;
  remaining: number;
  costPrice: number;
  drug?: { name: string };
}

interface InventoryLog {
  id: string;
  drugId: string;
  drugName: string;
  type: "PURCHASE" | "SALE" | "ADJUSTMENT" | "RETURN" | "DAMAGE" | "EXPIRED";
  quantity: number;
  previousStock: number;
  newStock: number;
  notes: string | null;
  createdAt: string;
  user: { name: string } | null;
  batchNumber?: string;
}

export default function InventoryPage() {
  const [activeTab, setActiveTab] = useState("overview");
  const [drugs, setDrugs] = useState<Drug[]>([]);
  const [logs, setLogs] = useState<InventoryLog[]>([]);
  const [expiring, setExpiring] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 0 });

  // Filters for overview
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [stockStatus, setStockStatus] = useState("");
  const [sortBy, setSortBy] = useState("name");
  const [sortOrder, setSortOrder] = useState("asc");

  // Adjustment dialog
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [selectedDrug, setSelectedDrug] = useState<Drug | null>(null);
  const [batchesForDrug, setBatchesForDrug] = useState<Batch[]>([]);
  const [adjustType, setAdjustType] = useState<"ADJUSTMENT" | "DAMAGE" | "RETURN">("ADJUSTMENT");
  const [adjustQty, setAdjustQty] = useState<number>(1);
  const [adjustNotes, setAdjustNotes] = useState("");
  const [adjustBatchId, setAdjustBatchId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  // Fetch drugs (overview)
  useEffect(() => {
    const fetchDrugs = async () => {
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
        const res = await fetch(`/api/drug?${params}`);
        const data = await res.json();
        setDrugs(data.drugs || []);
        setPagination(data.pagination || { page: 1, limit: 10, total: 0, pages: 0 });
      } catch (error) {
        toast.error("Failed to load drugs");
      } finally {
        setLoading(false);
      }
    };
    fetchDrugs();
  }, [pagination.page, search, category, stockStatus, sortBy, sortOrder]);

  // Fetch expiring batches
  useEffect(() => {
    const fetchExpiring = async () => {
      try {
        const res = await fetch("/api/inventory/expiring");
        const data = await res.json();
        setExpiring(data.expiring || []);
      } catch (error) {
        console.error("Failed to fetch expiring", error);
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

  // When a drug is selected in adjust dialog, fetch its batches
  const handleDrugSelect = async (drugId: string) => {
    const drug = drugs.find(d => d.id === drugId);
    setSelectedDrug(drug || null);
    if (drugId) {
      try {
        const res = await fetch(`/api/drug/${drugId}/batches`);
        const data = await res.json();
        setBatchesForDrug(data.batches || []);
      } catch (error) {
        toast.error("Failed to fetch batches");
      }
    } else {
      setBatchesForDrug([]);
    }
    setAdjustBatchId("");
  };

  const handleAdjustSubmit = async () => {
    if (!selectedDrug) {
      toast.error("Please select a drug");
      return;
    }
    if (adjustQty <= 0) {
      toast.error("Quantity must be positive");
      return;
    }
    // If drug has batches, ensure batch selected and quantity ≤ remaining
    if (batchesForDrug.length > 0) {
      if (!adjustBatchId) {
        toast.error("Please select a batch");
        return;
      }
      const batch = batchesForDrug.find(b => b.id === adjustBatchId);
      if (batch && adjustQty > batch.remaining) {
        toast.error(`Batch ${batch.batchNumber} only has ${batch.remaining} remaining`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/inventory/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          drugId: selectedDrug.id,
          quantity: adjustQty,
          type: adjustType,
          notes: adjustNotes,
          batchId: adjustBatchId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Adjustment failed");
      toast.success("Stock adjusted");
      setAdjustOpen(false);
      // Reset form
      setSelectedDrug(null);
      setBatchesForDrug([]);
      setAdjustType("ADJUSTMENT");
      setAdjustQty(1);
      setAdjustNotes("");
      setAdjustBatchId("");
      // Refresh relevant tabs
      setPagination(prev => ({ ...prev, page: 1 })); // refresh overview
      // Optionally refresh logs and expiring
      const logsRes = await fetch("/api/inventory/logs");
      setLogs((await logsRes.json()).logs || []);
      const expRes = await fetch("/api/inventory/expiring");
      setExpiring((await expRes.json()).expiring || []);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
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

  return (
    <>
      <Header
        title="Inventory Management"
        subtitle="Track stock, batches, and expiry"
        actions={
          <Button onClick={() => setAdjustOpen(true)}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Adjust Stock
          </Button>
        }
      />

      <div className="p-6 space-y-6">
        {/* Expiry Alert Banner */}
        {expiring.length > 0 && (
          <Card className="border-yellow-200 bg-yellow-50">
            <CardContent className="p-4 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              <span className="text-sm text-yellow-800">
                {expiring.length} batch(es) are expiring within 30 days or already expired.
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
                      onChange={(e) => {
                        setSearch(e.target.value);
                        setPagination(prev => ({ ...prev, page: 1 }));
                      }}
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
                    <Select
                      value={`${sortBy}-${sortOrder}`}
                      onValueChange={(val) => {
                        const [sb, so] = val.split("-");
                        setSortBy(sb);
                        setSortOrder(so as "asc" | "desc");
                      }}
                    >
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
                  <Button variant="outline" size="sm" onClick={() => {
                    setSearch("");
                    setCategory("");
                    setStockStatus("");
                    setSortBy("name");
                    setSortOrder("asc");
                    setPagination(prev => ({ ...prev, page: 1 }));
                  }}>
                    Clear Filters
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-0">
                {loading ? (
                  <div className="p-8 text-center">Loading...</div>
                ) : drugs.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">No drugs found</div>
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
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                handleDrugSelect(drug.id);
                                setAdjustOpen(true);
                              }}
                            >
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
                <CardTitle>All Batches</CardTitle>
              </CardHeader>
              <CardContent>
                {drugs.filter(d => d.batches && d.batches.length > 0).length === 0 ? (
                  <p className="text-center text-muted-foreground">No batches found</p>
                ) : (
                  drugs.map((drug) =>
                    drug.batches && drug.batches.length > 0 ? (
                      <div key={drug.id} className="mb-6 last:mb-0">
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
                    ) : null
                  )
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Expiry Monitoring Tab */}
          <TabsContent value="expiring" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Expiring & Expired Batches</CardTitle>
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
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expiring.map((batch) => {
                      const daysLeft = Math.ceil(
                        (new Date(batch.expiryDate).getTime() - Date.now()) / (1000 * 3600 * 24)
                      );
                      return (
                        <TableRow key={batch.id}>
                          <TableCell>{batch.drug?.name || "—"}</TableCell>
                          <TableCell>{batch.batchNumber}</TableCell>
                          <TableCell>{formatDate(batch.expiryDate)}</TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                daysLeft < 0
                                  ? "destructive"
                                  : daysLeft < 30
                                  ? "warning"
                                  : "default"
                              }
                            >
                              {daysLeft < 0 ? "Expired" : `${daysLeft} days`}
                            </Badge>
                          </TableCell>
                          <TableCell>{batch.remaining}</TableCell>
                        </TableRow>
                      );
                    })}
                    {expiring.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">
                          No expiring batches found
                        </TableCell>
                      </TableRow>
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
                <CardTitle>Recent Inventory Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Drug</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Quantity</TableHead>
                      <TableHead className="text-right">Previous</TableHead>
                      <TableHead className="text-right">New</TableHead>
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
                          <Badge
                            variant={
                              log.type === "PURCHASE"
                                ? "success"
                                : log.type === "SALE"
                                ? "default"
                                : log.type === "ADJUSTMENT"
                                ? "warning"
                                : "destructive"
                            }
                          >
                            {log.type}
                          </Badge>
                        </TableCell>
                        <TableCell
                          className={`text-right ${
                            log.quantity > 0 ? "text-green-600" : "text-red-600"
                          }`}
                        >
                          {log.quantity > 0 ? `+${log.quantity}` : log.quantity}
                        </TableCell>
                        <TableCell className="text-right">{log.previousStock}</TableCell>
                        <TableCell className="text-right">{log.newStock}</TableCell>
                        <TableCell>{log.user?.name || "System"}</TableCell>
                        <TableCell className="max-w-xs truncate">{log.notes}</TableCell>
                      </TableRow>
                    ))}
                    {logs.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground">
                          No inventory logs yet
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Stock Adjustment Dialog */}
      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Adjust Stock</DialogTitle>
            <DialogDescription>
              Manually add or remove stock. For purchases, use Purchase Orders.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="drug">Drug *</Label>
              <Select onValueChange={handleDrugSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a drug" />
                </SelectTrigger>
                <SelectContent>
                  {drugs.map((drug) => (
                    <SelectItem key={drug.id} value={drug.id}>
                      {drug.name} (Stock: {drug.stock})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedDrug && batchesForDrug.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="batch">Batch *</Label>
                <Select value={adjustBatchId} onValueChange={setAdjustBatchId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a batch" />
                  </SelectTrigger>
                  <SelectContent>
                    {batchesForDrug.map((batch) => {
                      const daysLeft = Math.ceil(
                        (new Date(batch.expiryDate).getTime() - Date.now()) / (1000 * 3600 * 24)
                      );
                      return (
                        <SelectItem key={batch.id} value={batch.id}>
                          {batch.batchNumber} – Exp: {formatDate(batch.expiryDate)} (Rem:{" "}
                          {batch.remaining}) {daysLeft < 0 ? "(Expired)" : ""}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                {batchesForDrug.length === 1 && (
                  <p className="text-xs text-muted-foreground">
                    Only one batch available. It has been auto‑selected.
                  </p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="type">Adjustment Type *</Label>
              <Select
                value={adjustType}
                onValueChange={(value: any) => setAdjustType(value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADJUSTMENT">Manual Adjustment</SelectItem>
                  <SelectItem value="DAMAGE">Damage / Waste</SelectItem>
                  <SelectItem value="RETURN">Return</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="qty">Quantity *</Label>
              <Input
                id="qty"
                type="number"
                min={1}
                value={adjustQty}
                onChange={(e) => setAdjustQty(parseInt(e.target.value) || 1)}
              />
              <p className="text-xs text-muted-foreground">
                {adjustType === "DAMAGE" ? "Negative quantity (will subtract)" : "Positive quantity (will add)"}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Optional reason"
                value={adjustNotes}
                onChange={(e) => setAdjustNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAdjustSubmit} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}