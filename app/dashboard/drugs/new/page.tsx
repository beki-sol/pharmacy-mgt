"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
import { CalendarIcon, Loader2 } from "lucide-react";
import { Calendar } from "@/app/components/ui/Calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/app/components/ui/Popover";
import { cn } from "@/app/lib/utils";
import { format } from "date-fns";
import toast from "react-hot-toast";

// Schema matching the API's drugSchema, but with batch fields included
const drugFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  genericName: z.string().optional(),
  brand: z.string().optional(),
  category: z.enum([
    "PRESCRIPTION",
    "OVER_THE_COUNTER",
    "CONTROLLED",
    "HERBAL",
    "SUPPLEMENTS",
    "VACCINE",
    "MEDICAL_SUPPLY",
  ]),
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
});

type DrugFormData = z.infer<typeof drugFormSchema>;

interface Supplier {
  id: string;
  name: string;
}

export default function NewDrugPage() {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchingSuppliers, setFetchingSuppliers] = useState(true);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<DrugFormData>({
    resolver: zodResolver(drugFormSchema),
    defaultValues: {
      category: "PRESCRIPTION",
      stock: 0,
      minStockLevel: 10,
      maxStockLevel: 100,
      reorderPoint: 20,
    },
  });

  const expiryDate = watch("expiryDate");

  // Fetch suppliers for dropdown
  useEffect(() => {
    const fetchSuppliers = async () => {
      try {
        const res = await fetch("/api/suppliers?limit=100");
        const data = await res.json();
        setSuppliers(data.suppliers || []);
      } catch (error) {
        console.error("Failed to load suppliers", error);
        toast.error("Could not load suppliers");
      } finally {
        setFetchingSuppliers(false);
      }
    };
    fetchSuppliers();
  }, []);

  const onSubmit = async (data: DrugFormData) => {
    setLoading(true);
    try {
      // Convert date to ISO string for API
      const payload = {
        ...data,
        expiryDate: data.expiryDate ? data.expiryDate.toISOString() : undefined,
      };
      const res = await fetch("/api/drugs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || "Failed to create drug");
      }
      toast.success("Drug added successfully");
      router.push("/dashboard/drugs");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  if (fetchingSuppliers) {
    return (
      <>
        <Header title="Add Drug" />
        <div className="p-6 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </>
    );
  }

  return (
    <>
      <Header title="Add New Drug" subtitle="Create a new drug record" />
      <div className="p-6 max-w-4xl mx-auto">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>Enter the drug's details</CardDescription>
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
                <Label htmlFor="category">Category *</Label>
                <Select
                  onValueChange={(value: any) => setValue("category", value)}
                  defaultValue="PRESCRIPTION"
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PRESCRIPTION">Prescription</SelectItem>
                    <SelectItem value="OVER_THE_COUNTER">Over the Counter</SelectItem>
                    <SelectItem value="CONTROLLED">Controlled</SelectItem>
                    <SelectItem value="HERBAL">Herbal</SelectItem>
                    <SelectItem value="SUPPLEMENTS">Supplements</SelectItem>
                    <SelectItem value="VACCINE">Vaccine</SelectItem>
                    <SelectItem value="MEDICAL_SUPPLY">Medical Supply</SelectItem>
                  </SelectContent>
                </Select>
                {errors.category && (
                  <p className="text-sm text-destructive">{errors.category.message}</p>
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
                <Select onValueChange={(value) => setValue("supplierId", value)}>
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

          <Card>
            <CardHeader>
              <CardTitle>Pricing & Stock</CardTitle>
              <CardDescription>Set pricing and stock levels</CardDescription>
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
                <Label htmlFor="stock">Initial Stock *</Label>
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

          <Card>
            <CardHeader>
              <CardTitle>Batch Information</CardTitle>
              <CardDescription>Initial batch details (optional)</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="batchNumber">Batch Number</Label>
                <Input id="batchNumber" {...register("batchNumber")} />
              </div>
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
            </CardContent>
          </Card>

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
            </CardContent>
            <CardFooter className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Drug
              </Button>
            </CardFooter>
          </Card>
        </form>
      </div>
    </>
  );
}