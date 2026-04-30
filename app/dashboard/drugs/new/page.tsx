"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Papa from "papaparse";
import { format } from "date-fns";
import toast from "react-hot-toast";
import {
  Upload,
  FileUp,
  Loader2,
  CalendarIcon,
  Check,
  X,
} from "lucide-react";

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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/app/components/ui/Table";
import { Calendar } from "@/app/components/ui/Calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/app/components/ui/Popover";
import { cn } from "@/app/lib/utils";

// Form schema
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

export default function NewDrugPage() {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchingData, setFetchingData] = useState(true);

  // CSV import state
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<DrugFormData>({
    resolver: zodResolver(drugFormSchema),
    defaultValues: {
      stock: 0,
      minStockLevel: 10,
      maxStockLevel: 100,
      reorderPoint: 20,
    },
  });

  const expiryDate = watch("expiryDate");

  // Fetch suppliers and categories
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [suppliersRes, categoriesRes] = await Promise.all([
          fetch("/api/suppliers?limit=100"),
          fetch("/api/categories"),
        ]);
        const suppliersData = await suppliersRes.json();
        const categoriesData = await categoriesRes.json();
        setSuppliers(suppliersData.suppliers || []);
        setCategories(categoriesData.categories || []);
      } catch (error) {
        console.error("Failed to load data", error);
        toast.error("Could not load required data");
      } finally {
        setFetchingData(false);
      }
    };
    fetchData();
  }, []);

  // Single drug creation
  const onSubmit = async (data: DrugFormData) => {
    setLoading(true);
    try {
      const payload = {
        ...data,
        expiryDate: data.expiryDate ? data.expiryDate.toISOString() : undefined,
      };
      const res = await fetch("/api/drug", {
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

  // CSV import handlers
  const handleFileUpload = (file: File) => {
    setCsvFile(file);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        setCsvData(results.data);
        toast.success(`Parsed ${results.data.length} rows`);
      },
      error: (error) => {
        toast.error("Failed to parse CSV: " + error.message);
      },
    });
  };

  const handleImport = async () => {
  if (!csvData.length) {
    toast.error("No data to import");
    return;
  }
  setImporting(true);
  try {
    const res = await fetch("/api/drug/bulk-import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows: csvData }),
    });
    const result = await res.json();
    if (!res.ok) {
      // Show detailed validation errors from API
      const errorMsg = result.details ? result.details.join(", ") : result.error;
      throw new Error(errorMsg || "Import failed");
    }
    setImportResult(result);
    toast.success(`Imported ${result.results?.length || 0} items`);
    if (result.errors?.length) {
      toast.error(`${result.errors.length} rows failed`);
      console.error("Import errors:", result.errors);
      // Optionally show errors in the UI
      setImportResult((prev: any) => ({ ...prev, detailedErrors: result.errors }));
    }
    setTimeout(() => {
      router.refresh();
      setImportDialogOpen(false);
      setCsvFile(null);
      setCsvData([]);
      setImportResult(null);
    }, 2000);
  } catch (err: any) {
    toast.error(err.message);
  } finally {
    setImporting(false);
  }
};
  if (fetchingData) {
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
      <Header
        title="Add New Drug"
        subtitle="Create a new drug record or import multiple from CSV"
        actions={
          <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Import CSV
          </Button>
        }
      />
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
                <Label htmlFor="categoryId">Category *</Label>
                <Select
                  onValueChange={(value) => setValue("categoryId", value)}
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

      {/* CSV Import Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import Drugs from CSV</DialogTitle>
            <DialogDescription>
              Upload a CSV file with columns: drugName, genericName, category, brand, dosage, unit, price, costPrice, barcode, batchNumber, expiryDate (YYYY-MM-DD), quantityTransferred (optional). 
              The system will create categories, drugs, and batches automatically.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* File upload area */}
            <div className="border-2 border-dashed rounded-lg p-6 text-center">
              <input
                type="file"
                accept=".csv"
                onChange={(e) => e.target.files && handleFileUpload(e.target.files[0])}
                className="hidden"
                id="csv-upload"
              />
              <label htmlFor="csv-upload" className="cursor-pointer inline-flex items-center gap-2 text-primary">
                <FileUp className="h-6 w-6" />
                <span>Choose CSV file</span>
              </label>
              {csvFile && <p className="mt-2 text-sm">Selected: {csvFile.name}</p>}
            </div>

            {/* Preview table */}
            {csvData.length > 0 && (
              <div>
                <h3 className="font-medium mb-2">Preview (first 5 rows)</h3>
                <div className="border rounded-md overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {Object.keys(csvData[0]).map((key) => (
                          <TableHead key={key}>{key}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {csvData.slice(0, 5).map((row, idx) => (
                        <TableRow key={idx}>
                          {Object.values(row).map((val: any, i) => (
                            <TableCell key={i}>{String(val).slice(0, 30)}</TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* Import result summary */}
            {importResult && (
              <div className="space-y-2 p-3 bg-gray-50 rounded-md">
                <h3 className="font-medium">Import Result</h3>
                <p>✅ Success: {importResult.results?.length || 0}</p>
                {importResult.errors?.length > 0 && (
                  <div className="text-destructive">
                    <p>❌ Errors: {importResult.errors.length}</p>
                    <ul className="text-sm list-disc pl-4">
                      {importResult.errors.slice(0, 3).map((err: any, i: number) => (
                        <li key={i}>{err.row}: {err.error}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setImportDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleImport} disabled={!csvData.length || importing}>
              {importing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}