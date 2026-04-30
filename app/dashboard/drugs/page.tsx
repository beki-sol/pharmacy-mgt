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
import { Plus, Search, Eye, Edit, Trash, ShoppingCart, Loader2 } from "lucide-react";
import Link from "next/link";
import { formatCurrency } from "@/app/lib/utils";
import toast from "react-hot-toast";

interface Batch {
  id: string;
  expiryDate: string;
  remaining: number;
}

interface Drug {
  id: string;
  name: string;
  genericName: string | null;
  category: string | { name: string };
  stock: number;
  price: number;
  minStockLevel: number;
  expiryDate: string | null;
  batches?: Batch[];
  supplier?: { name: string; email: string } | null;
  isActive?: boolean;
}

interface Category {
  id: string;
  name: string;
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
  if (!expiryDate) return <Badge variant="secondary">No Expiry</Badge>;
  const daysUntil = (new Date(expiryDate).getTime() - Date.now()) / (1000 * 3600 * 24);
  if (daysUntil < 0) return <Badge variant="destructive">Expired</Badge>;

  if (daysUntil < 60) return <Badge variant="warning">Expires Soon</Badge>;

  return <Badge variant="success">Valid</Badge>;
}

export default function DrugsPage() {
  const [drugs, setDrugs] = useState<Drug[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 0 });

  // Filters
  const [search, setSearch] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [lowStock, setLowStock] = useState("");
  const [expired, setExpired] = useState("");
  const [sortBy, setSortBy] = useState("name");
  const [sortOrder, setSortOrder] = useState("asc");
  const [showInactive, setShowInactive] = useState(false);

  // Delete state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [drugToDelete, setDrugToDelete] = useState<Drug | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Fetch categories on mount
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await fetch("/api/categories");
        const data = await res.json();
        setCategories(data.categories || []);
      } catch (error) {
        console.error("Failed to fetch categories", error);
      }
    };
    fetchCategories();
  }, []);

  // Fetch drugs
  const fetchDrugs = async () => {
    setLoading(true);
    const params = new URLSearchParams({
      page: pagination.page.toString(),
      limit: pagination.limit.toString(),
      search,
      ...(selectedCategoryId && { categoryId: selectedCategoryId }),
      ...(lowStock === "true" && { lowStock: "true" }),
      ...(expired === "true" && { expired: "true" }),
      ...(showInactive && { showInactive: "true" }),
      sortBy,
      sortOrder,
    });
    try {
      const res = await fetch(`/api/drug?${params}`);
      const data = await res.json();
      setDrugs(data.drugs || []);
      setPagination(data.pagination || { page: 1, limit: 10, total: 0, pages: 0 });
    } catch (error) {
      console.error("Failed to fetch drugs", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDrugs();
  }, [pagination.page, search, selectedCategoryId, lowStock, expired, sortBy, sortOrder, showInactive]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const clearFilters = () => {
    setSearch("");
    setSelectedCategoryId("");
    setLowStock("");
    setExpired("");
    setSortBy("name");
    setSortOrder("asc");
    setShowInactive(false);
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const getStockStatusBadge = (stock: number, min: number) => {
    if (stock === 0) return <Badge variant="destructive">Out of Stock</Badge>;
    if (stock <= min) return <Badge variant="warning">Low Stock</Badge>;
    return <Badge variant="success">In Stock</Badge>;
  };

  const getCategoryName = (cat: Drug['category']): string => {
    if (!cat) return '—';
    if (typeof cat === 'string') return cat.replace(/_/g, " ");
    return cat.name?.replace(/_/g, " ") || '—';
  };

  // Delete handlers
  const handleDeleteClick = (drug: Drug) => {
    setDrugToDelete(drug);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!drugToDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/drug/${drugToDelete.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed");
      toast.success(data.message || `Drug "${drugToDelete.name}" deleted/deactivated`);
      setDeleteDialogOpen(false);
      setDrugToDelete(null);
      await fetchDrugs();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Header 
        title="Drugs" 
        subtitle="Manage your drug inventory"
        actions={
          <Button asChild>
            <Link href="/dashboard/drugs/new">
              <Plus className="mr-2 h-4 w-4" />
              Add Drug
            </Link>
          </Button>
        }
      />
      <div className="p-6 space-y-4">
        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
              <div className="space-y-2">
                <Label>Search</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Name, generic, barcode..."
                    className="pl-8"
                    value={search}
                    onChange={handleSearch}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={selectedCategoryId || "ALL"} onValueChange={(val) => setSelectedCategoryId(val === "ALL" ? "" : val)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Categories</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Stock Status</Label>
                <Select value={lowStock} onValueChange={(val) => setLowStock(val === "ALL" ? "" : val)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All</SelectItem>
                    <SelectItem value="true">Low Stock Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Expiry</Label>
                <Select value={expired} onValueChange={(val) => setExpired(val === "ALL" ? "" : val)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All</SelectItem>
                    <SelectItem value="true">Expired Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Sort By</Label>
                <Select value={`${sortBy}-${sortOrder}`} onValueChange={(val) => {
                  const [sb, so] = val.split("-");
                  setSortBy(sb);
                  setSortOrder(so as "asc" | "desc");
                }}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name-asc">Name (A-Z)</SelectItem>
                    <SelectItem value="name-desc">Name (Z-A)</SelectItem>
                    <SelectItem value="stock-asc">Stock (Low-High)</SelectItem>
                    <SelectItem value="stock-desc">Stock (High-Low)</SelectItem>
                    <SelectItem value="price-asc">Price (Low-High)</SelectItem>
                    <SelectItem value="price-desc">Price (High-Low)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="showInactive"
                    checked={showInactive}
                    onChange={(e) => setShowInactive(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <Label htmlFor="showInactive">Show inactive drugs</Label>
                </div>
              </div>
            </div>
            <div className="flex justify-end mt-4">
              <Button variant="outline" size="sm" onClick={clearFilters}>
                Clear Filters
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Drugs Table */}
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
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Expiry</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {drugs.map((drug) => {
                    const effectiveExpiry = getEffectiveExpiryDate(drug);
                    const isInactive = drug.isActive === false;
                    return (
                      <TableRow key={drug.id} className={isInactive ? "bg-muted/40" : ""}>
                        <TableCell className="font-medium">
                          <div>
                            {drug.name}
                            {drug.genericName && (
                              <p className="text-xs text-muted-foreground">{drug.genericName}</p>
                            )}
                            {isInactive && (
                              <Badge variant="secondary" className="mt-1">Inactive</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{getCategoryName(drug.category)}</TableCell>
                        <TableCell>{drug.stock}</TableCell>
                        <TableCell>{formatCurrency(drug.price)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {effectiveExpiry ? new Date(effectiveExpiry).toLocaleDateString() : "—"}
                            {getExpiryStatus(effectiveExpiry)}
                          </div>
                        </TableCell>
                        <TableCell>{getStockStatusBadge(drug.stock, drug.minStockLevel)}</TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button variant="ghost" size="icon" asChild>
                            <Link href={`/dashboard/drugs/${drug.id}`}>
                              <Eye className="h-4 w-4" />
                            </Link>
                          </Button>
                          <Button variant="ghost" size="icon" asChild>
                            <Link href={`/dashboard/drugs/${drug.id}/edit`}>
                              <Edit className="h-4 w-4" />
                            </Link>
                          </Button>
                          <Button variant="ghost" size="icon" asChild>
                            <Link href={`/dashboard/purchase-orders/new?drugId=${drug.id}`}>
                              <ShoppingCart className="h-4 w-4" />
                            </Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive"
                            onClick={() => handleDeleteClick(drug)}
                          >
                            <Trash className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Drug</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{drugToDelete?.name}"? 
              {drugToDelete?.stock && drugToDelete.stock > 0 && " It still has stock. If there are transactions, it will be deactivated instead of permanently deleted."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={deleting}>
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}