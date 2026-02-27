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
import { Plus, Search, Eye, Edit, Trash } from "lucide-react";
import Link from "next/link";
import { formatCurrency } from "@/app/lib/utils";

interface Drug {
  id: string;
  name: string;
  genericName: string | null;
  category: string;
  stock: number;
  price: number;
  minStockLevel: number;
  expiryDate: string | null;
}

export default function DrugsPage() {
  const [drugs, setDrugs] = useState<Drug[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 0 });

  // Filters
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [lowStock, setLowStock] = useState(""); // "true" or ""
  const [expired, setExpired] = useState("");   // "true" or ""
  const [sortBy, setSortBy] = useState("name");
  const [sortOrder, setSortOrder] = useState("asc");

  useEffect(() => {
    const fetchDrugs = async () => {
      setLoading(true);
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
        search,
        ...(category && category !== "ALL" && { category }),
        ...(lowStock === "true" && { lowStock: "true" }),
        ...(expired === "true" && { expired: "true" }),
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
    fetchDrugs();
  }, [pagination.page, search, category, lowStock, expired, sortBy, sortOrder]);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const clearFilters = () => {
    setSearch("");
    setCategory("");
    setLowStock("");
    setExpired("");
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
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
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
                      <TableCell>{formatCurrency(drug.price)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {drug.expiryDate ? new Date(drug.expiryDate).toLocaleDateString() : "—"}
                          {getExpiryStatus(drug.expiryDate)}
                        </div>
                      </TableCell>
                      <TableCell>{getStockStatusBadge(drug.stock, drug.minStockLevel)}</TableCell>
                      <TableCell className="text-right">
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
                        <Button variant="ghost" size="icon" className="text-destructive">
                          <Trash className="h-4 w-4" />
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
      </div>
    </>
  );
}