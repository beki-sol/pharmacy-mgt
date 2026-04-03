"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Header } from "@/app/components/dashboard/Header";
import { Button } from "@/app/components/ui/Button";
import { Input } from "@/app/components/ui/Input";
import { Label } from "@/app/components/ui/Label";
import { Textarea } from "@/app/components/ui/Textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/app/components/ui/Card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/Select";
import { CalendarIcon, Loader2, AlertTriangle } from "lucide-react";
import { Calendar } from "@/app/components/ui/Calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/app/components/ui/Popover";
import { cn } from "@/app/lib/utils";
import { format } from "date-fns";
import toast from "react-hot-toast";
import { Switch } from "@/app/components/ui/Switch";

const drugFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  genericName: z.string().optional(),
  brand: z.string().optional(),
  categoryId: z.string().min(1, "Category is required"),
  dosage: z.string().min(1, "Dosage is required"),
  unit: z.string().min(1, "Unit is required"),
  price: z.number().positive("Price must be positive"),
  costPrice: z.number().positive("Cost price must be positive"),
  stock: z.number().int().min(0, "Stock cannot be negative"),
  minStockLevel: z.number().int().min(0),
  maxStockLevel: z.number().int().min(0),
  reorderPoint: z.number().int().min(0),
  expiryDate: z.date().optional(),
  batchNumber: z.string().optional(),
  supplierId: z.string().optional(),
  barcode: z.string().optional(),
  description: z.string().optional(),
  sideEffects: z.string().optional(),
  storageCondition: z.string().optional(),
  isActive: z.boolean().optional(),
});

type DrugFormData = z.infer<typeof drugFormSchema>;

interface Supplier {
  id: string;
  name: string;
}

interface Category {
  id: string;
  name: string;
}

interface Batch {
  id: string;
  batchNumber: string;
  expiryDate: string;
  remaining: number;
}

export default function EditDrugPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<DrugFormData>({
    resolver: zodResolver(drugFormSchema),
  });

  const expiryDate = watch("expiryDate");
  const isActive = watch("isActive");

  // Fetch drug data, suppliers, categories, and batches
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [drugRes, suppliersRes, categoriesRes] = await Promise.all([
          fetch(`/api/drug/${id}`),
          fetch("/api/suppliers?limit=100"),
          fetch("/api/categories"),
        ]);

        if (!drugRes.ok) {
          if (drugRes.status === 404) throw new Error("Drug not found");
          throw new Error("Failed to load drug");
        }
        const drug = await drugRes.json();

        const suppliersData = await suppliersRes.json();
        setSuppliers(suppliersData.suppliers || []);

        const categoriesData = await categoriesRes.json();
        setCategories(categoriesData.categories || []);

        setBatches(drug.batches || []);

        // Pre‑fill form with existing data
        const categoryId = typeof drug.category === 'object' ? drug.category?.id : drug.categoryId;
        reset({
          name: drug.name,
          genericName: drug.genericName || "",
          brand: drug.brand || "",
          categoryId: categoryId || "",
          dosage: drug.dosage,
          unit: drug.unit,
          price: drug.price,
          costPrice: drug.costPrice,
          stock: drug.stock,
          minStockLevel: drug.minStockLevel,
          maxStockLevel: drug.maxStockLevel,
          reorderPoint: drug.reorderPoint,
          // Only pre‑fill expiryDate if there are no batches
          expiryDate: drug.batches?.length === 0 && drug.expiryDate ? new Date(drug.expiryDate) : undefined,
          batchNumber: drug.batchNumber || "",
          supplierId: drug.supplierId || "",
          barcode: drug.barcode || "",
          description: drug.description || "",
          sideEffects: drug.sideEffects || "",
          storageCondition: drug.storageCondition || "",
          isActive: drug.isActive,
        });
      } catch (err: any) {
        setError(err.message);
        toast.error(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id, reset]);

  const onSubmit = async (data: DrugFormData) => {
    setSaving(true);
    try {
      const payload: any = {
        ...data,
        // Only include expiryDate if there are no batches
        expiryDate: batches.length === 0 && data.expiryDate ? data.expiryDate.toISOString() : undefined,
      };
      // Include batch expiry updates if there are batches
      if (batches.length > 0) {
        payload.batches = batches.map(b => ({ id: b.id, expiryDate: b.expiryDate }));
      }
      const res = await fetch(`/api/drug/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || "Failed to update drug");
      }
      toast.success("Drug updated successfully");
      router.push(`/dashboard/drugs/${id}`);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleBatchExpiryChange = (idx: number, date: Date | undefined) => {
    if (date) {
      const newBatches = [...batches];
      newBatches[idx].expiryDate = date.toISOString();
      setBatches(newBatches);
    }
  };

  if (loading) {
    return (
      <>
        <Header title="Edit Drug" />
        <div className="p-6 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Header title="Error" />
        <div className="p-6 text-center text-destructive">
          <AlertTriangle className="h-12 w-12 mx-auto mb-4" />
          <p>{error}</p>
          <Button className="mt-4" onClick={() => router.back()}>
            Go Back
          </Button>
        </div>
      </>
    );
  }

  return (
    <>
      <Header title="Edit Drug" subtitle="Update drug information" />
      <div className="p-6 max-w-4xl mx-auto">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Basic Information Card */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>Edit the drug's details</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Drug Name *</Label>
                <Input id="name" {...register("name")} />
                {errors.name && (
                  <p className="text-sm text-destructive">{errors.name.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="genericName">Generic Name</Label>
                <Input id="genericName" {...register("genericName")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="brand">Brand</Label>
                <Input id="brand" {...register("brand")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="categoryId">Category *</Label>
                <Select
                  onValueChange={(value) => setValue("categoryId", value)}
                  value={watch("categoryId")}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.categoryId && (
                  <p className="text-sm text-destructive">{errors.categoryId.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="dosage">Dosage *</Label>
                <Input id="dosage" {...register("dosage")} />
                {errors.dosage && (
                  <p className="text-sm text-destructive">{errors.dosage.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="unit">Unit *</Label>
                <Input id="unit" {...register("unit")} />
                {errors.unit && (
                  <p className="text-sm text-destructive">{errors.unit.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="barcode">Barcode</Label>
                <Input id="barcode" {...register("barcode")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="supplierId">Supplier</Label>
                <Select
                  onValueChange={(value) => setValue("supplierId", value)}
                  value={watch("supplierId") || ""}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select supplier" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map((sup) => (
                      <SelectItem key={sup.id} value={sup.id}>
                        {sup.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Pricing & Stock Card */}
          <Card>
            <CardHeader>
              <CardTitle>Pricing & Stock</CardTitle>
              <CardDescription>Adjust pricing and stock levels</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="price">Selling Price ($) *</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  {...register("price", { valueAsNumber: true })}
                />
                {errors.price && (
                  <p className="text-sm text-destructive">{errors.price.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="costPrice">Cost Price ($) *</Label>
                <Input
                  id="costPrice"
                  type="number"
                  step="0.01"
                  {...register("costPrice", { valueAsNumber: true })}
                />
                {errors.costPrice && (
                  <p className="text-sm text-destructive">{errors.costPrice.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="stock">Current Stock *</Label>
                <Input
                  id="stock"
                  type="number"
                  {...register("stock", { valueAsNumber: true })}
                />
                {errors.stock && (
                  <p className="text-sm text-destructive">{errors.stock.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="minStockLevel">Min Stock Level *</Label>
                <Input
                  id="minStockLevel"
                  type="number"
                  {...register("minStockLevel", { valueAsNumber: true })}
                />
                {errors.minStockLevel && (
                  <p className="text-sm text-destructive">{errors.minStockLevel.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxStockLevel">Max Stock Level *</Label>
                <Input
                  id="maxStockLevel"
                  type="number"
                  {...register("maxStockLevel", { valueAsNumber: true })}
                />
                {errors.maxStockLevel && (
                  <p className="text-sm text-destructive">{errors.maxStockLevel.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="reorderPoint">Reorder Point *</Label>
                <Input
                  id="reorderPoint"
                  type="number"
                  {...register("reorderPoint", { valueAsNumber: true })}
                />
                {errors.reorderPoint && (
                  <p className="text-sm text-destructive">{errors.reorderPoint.message}</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Batch Information Card */}
          <Card>
            <CardHeader>
              <CardTitle>Batch Information</CardTitle>
              <CardDescription>
                {batches.length === 0
                  ? "Set the drug's expiry date (no batches exist)."
                  : "Edit expiry dates for each batch."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {batches.length === 0 ? (
                // No batches – show single expiry date field
                <div className="space-y-2">
                  <Label htmlFor="expiryDate">Expiry Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !expiryDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {expiryDate ? format(expiryDate, "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={expiryDate}
                        onSelect={(date) => date && setValue("expiryDate", date)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              ) : (
                // Batches exist – show list of batch expiry pickers
                <div className="space-y-4">
                  {batches.map((batch, idx) => (
                    <div key={batch.id} className="flex items-center gap-4 p-2 border rounded">
                      <span className="font-medium w-32">{batch.batchNumber}</span>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="flex-1 justify-start text-left font-normal">
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {batch.expiryDate ? format(new Date(batch.expiryDate), "PPP") : "Pick a date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={batch.expiryDate ? new Date(batch.expiryDate) : undefined}
                            onSelect={(date) => handleBatchExpiryChange(idx, date)}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Additional Information Card (unchanged) */}
          <Card>
            <CardHeader>
              <CardTitle>Additional Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" {...register("description")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sideEffects">Side Effects</Label>
                <Textarea id="sideEffects" {...register("sideEffects")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="storageCondition">Storage Conditions</Label>
                <Input id="storageCondition" {...register("storageCondition")} />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="isActive"
                  checked={isActive}
                  onCheckedChange={(checked) => setValue("isActive", checked)}
                />
                <Label htmlFor="isActive">Active (visible in lists)</Label>
              </div>
            </CardContent>
            <CardFooter className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </CardFooter>
          </Card>
        </form>
      </div>
    </>
  );
}