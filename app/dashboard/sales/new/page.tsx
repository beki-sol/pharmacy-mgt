"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Header } from "@/app/components/dashboard/Header";
import { Button } from "@/app/components/ui/Button";
import { Input } from "@/app/components/ui/Input";
import { Label } from "@/app/components/ui/Label";
import { Textarea } from "@/app/components/ui/Textarea";
import { DrugSelect } from "@/app/components/ui/drug-select";
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
import { Plus, Trash2, Loader2, Save, FolderOpen } from "lucide-react";
import toast from "react-hot-toast";

// Schema – email is now a plain optional string (no validation)
const itemSchema = z.object({
  drugId: z.string().min(1, "Drug is required"),
  quantity: z.number().int().positive(),
  unitPrice: z.number().positive(),
  discount: z.number().min(0),
  batchId: z.string().optional(),
});

const saleFormSchema = z.object({
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  customerEmail: z.string().optional(),
  paymentMethod: z.enum(["CASH", "CARD", "INSURANCE", "MIXED", "CHAPA"]),
  status: z.enum(["COMPLETED", "PENDING", "PARTIALLY_PAID"]),
  items: z.array(itemSchema).min(1, "At least one item required"),
  discount: z.number().min(0),
  tax: z.number().min(0),
  notes: z.string().optional(),
  isPrescription: z.boolean(),
});

type SaleFormData = z.infer<typeof saleFormSchema>;

interface Drug {
  id: string;
  name: string;
  genericName: string | null;
  unit: string;
  price: number;
  stock: number;
}

interface Batch {
  id: string;
  batchNumber: string;
  expiryDate: string;
  remaining: number;
}

interface Draft {
  id: string;
  data: SaleFormData;
}

export default function NewSalePage() {
  const router = useRouter();
  const [drugs, setDrugs] = useState<Drug[]>([]);
  const [batches, setBatches] = useState<Record<string, Batch[]>>({});
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [draftDialogOpen, setDraftDialogOpen] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<SaleFormData>({
    resolver: zodResolver(saleFormSchema),
    defaultValues: {
      items: [{ drugId: "", quantity: 1, unitPrice: 0, discount: 0 }],
      paymentMethod: "CASH",
      status: "COMPLETED",
      discount: 0,
      tax: 0,
      isPrescription: false,
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const watchedItems = watch("items");

  // Load drugs
  useEffect(() => {
    const fetchDrugs = async () => {
      try {
        const res = await fetch("/api/drug?limit=100");
        if (!res.ok) throw new Error("Failed to load drugs");
        const data = await res.json();
        setDrugs(data.drugs || []);
      } catch (error) {
        console.error("Fetch drugs error:", error);
        toast.error("Failed to load drugs");
      } finally {
        setFetching(false);
      }
    };
    fetchDrugs();
  }, []);

  // Fetch batches when drug changes
  useEffect(() => {
    const fetchBatches = async () => {
      const drugIds = watchedItems.map((i) => i.drugId).filter(Boolean);
      const uniqueIds = [...new Set(drugIds)];
      const batchMap: Record<string, Batch[]> = {};
      await Promise.all(
        uniqueIds.map(async (drugId) => {
          if (!drugId) return;
          try {
            const res = await fetch(`/api/drug/${drugId}/batches`);
            if (!res.ok) throw new Error(`Failed to fetch batches for drug ${drugId}`);
            const data = await res.json();
            batchMap[drugId] = data.batches || [];
          } catch (error) {
            console.error("Fetch batches error:", error);
          }
        })
      );
      setBatches(batchMap);
    };
    fetchBatches();
  }, [watchedItems.map((i) => i.drugId).join(",")]);

  // Auto-select batch if only one available
  useEffect(() => {
    fields.forEach((_, index) => {
      const drugId = watchedItems[index]?.drugId;
      if (!drugId) return;
      const available = batches[drugId];
      if (available?.length === 1 && !watchedItems[index]?.batchId) {
        setValue(`items.${index}.batchId`, available[0].id);
      }
    });
  }, [batches, watchedItems, setValue, fields]);

  // Load drafts list
  const loadDrafts = async () => {
    try {
      const res = await fetch("/api/sales/drafts");
      if (!res.ok) throw new Error("Failed to load drafts");
      const data = await res.json();
      setDrafts(data.drafts || []);
    } catch (error) {
      console.error("Load drafts error:", error);
      toast.error("Failed to load drafts");
    }
  };

  const saveDraft = async () => {
    const currentData = watch();
    if (currentData.items.length === 0 || !currentData.items[0].drugId) {
      toast.error("Add at least one item before saving draft");
      return;
    }
    setSavingDraft(true);
    try {
      const res = await fetch("/api/sales/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: currentData }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to save draft");
      }
      toast.success("Draft saved");
      await loadDrafts();
    } catch (error: any) {
      console.error("Save draft error:", error);
      toast.error(error.message);
    } finally {
      setSavingDraft(false);
    }
  };

  const loadDraft = (draft: Draft) => {
    let data = draft.data;
    // Check if this is a cart draft (from drug page)
    if ((data as any).type === "cart") {
      // Convert cart items to sale items
      const convertedItems = (data as any).items.map((item: any) => ({
        drugId: item.drugId,
        quantity: item.quantity,
        unitPrice: item.price,
        discount: 0,
        batchId: item.batchId,
        batchNumber: item.batchNumber,
      }));
      // Create a sale form data object with defaults
      const saleData: SaleFormData = {
        customerName: "",
        customerPhone: "",
        customerEmail: "",
        paymentMethod: "CASH",
        status: "COMPLETED",
        items: convertedItems,
        discount: 0,
        tax: 0,
        notes: "",
        isPrescription: false,
      };
      reset(saleData);
    } else {
      // Normal sale draft
      reset(draft.data);
    }
    setDraftDialogOpen(false);
    toast.success("Draft loaded");
  };

  const deleteDraft = async (draftId: string) => {
    try {
      const res = await fetch(`/api/sales/drafts?draftId=${draftId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to delete");
      }
      setDrafts((prev) => prev.filter((d) => d.id !== draftId));
      toast.success("Draft deleted");
    } catch (error: any) {
      console.error("Delete draft error:", error);
      toast.error(error.message);
    }
  };

  const onSubmit = async (data: SaleFormData) => {
    // Client-side validation (stock/batch checks)
    for (const item of data.items) {
      const drug = drugs.find((d) => d.id === item.drugId);
      if (!drug) {
        toast.error("Invalid drug selection");
        return;
      }
      if (data.status === "COMPLETED") {
        if (item.quantity > drug.stock) {
          toast.error(`Insufficient stock for ${drug.name}. Available: ${drug.stock}`);
          return;
        }
        const drugBatches = batches[item.drugId];
        if (drugBatches && drugBatches.length > 0) {
          if (!item.batchId) {
            toast.error(`Please select a batch for ${drug.name}`);
            return;
          }
          const selectedBatch = drugBatches.find((b) => b.id === item.batchId);
          if (!selectedBatch) {
            toast.error(`Selected batch not found for ${drug.name}`);
            return;
          }
          if (item.quantity > selectedBatch.remaining) {
            toast.error(`Batch ${selectedBatch.batchNumber} has only ${selectedBatch.remaining} left`);
            return;
          }
          if (new Date(selectedBatch.expiryDate) < new Date()) {
            toast.error(`Batch ${selectedBatch.batchNumber} is expired`);
            return;
          }
        }
      }
    }

    setLoading(true);
    try {
      // Prepare payload – omit email if empty string
      const payload = {
        ...data,
        customerEmail: data.customerEmail && data.customerEmail.trim() !== "" ? data.customerEmail.trim() : undefined,
      };
      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || "Failed to create sale");
      }
      toast.success("Sale created successfully!");
      router.push("/dashboard/sales");
    } catch (error: any) {
      console.error("Submit sale error:", error);
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const calculateTotal = () => {
    const items = watch("items");
    const globalDiscount = watch("discount") || 0;
    const tax = watch("tax") || 0;
    let subtotal = 0;
    items.forEach((item) => {
      const itemSubtotal = (item.unitPrice || 0) * (item.quantity || 0);
      const itemAfterDiscount = itemSubtotal - (item.discount || 0);
      subtotal += itemAfterDiscount;
    });
    const afterGlobalDiscount = subtotal - globalDiscount;
    return afterGlobalDiscount + tax;
  };

  if (fetching) {
    return (
      <>
        <Header title="New Sale" />
        <div className="p-6 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </>
    );
  }

  return (
    <>
      <Header
        title="New Sale"
        subtitle="Create a new sales transaction"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={saveDraft} disabled={savingDraft}>
              {savingDraft ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save Draft
            </Button>
            <Button variant="outline" onClick={() => { loadDrafts(); setDraftDialogOpen(true); }}>
              <FolderOpen className="mr-2 h-4 w-4" />
              Load Draft
            </Button>
          </div>
        }
      />
      <div className="p-6 max-w-5xl mx-auto">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Customer Card */}
          <Card>
            <CardHeader>
              <CardTitle>Customer Information</CardTitle>
              <CardDescription>Optional customer details</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="customerName">Customer Name</Label>
                <Input id="customerName" {...register("customerName")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customerPhone">Phone</Label>
                <Input id="customerPhone" {...register("customerPhone")} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="customerEmail">Email</Label>
                <Input id="customerEmail" type="email" {...register("customerEmail")} />
                {errors.customerEmail && (
                  <p className="text-sm text-destructive">{errors.customerEmail.message}</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Items Card */}
          <Card>
            <CardHeader>
              <CardTitle>Items</CardTitle>
              <CardDescription>Add drugs to the sale</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {fields.map((field, index) => {
                const selectedDrugId = watch(`items.${index}.drugId`);
                const drug = drugs.find((d) => d.id === selectedDrugId);
                const availableBatches = selectedDrugId ? batches[selectedDrugId] || [] : [];

                return (
                  <div key={field.id} className="grid gap-4 p-4 border rounded-lg md:grid-cols-12 items-end">
                    {/* Drug Select */}
                    <div className="md:col-span-3 space-y-2">
                      <Label>Drug *</Label>
                      <DrugSelect
                        value={selectedDrugId}
                        onChange={(value, drug) => {
                          setValue(`items.${index}.drugId`, value);
                          setValue(`items.${index}.unitPrice`, drug.price);
                        }}
                        drugs={drugs}
                        error={errors.items?.[index]?.drugId?.message}
                      />
                    </div>
                    {/* Quantity */}
                    <div className="md:col-span-2 space-y-2">
                      <Label>Qty *</Label>
                      <Input
                        type="number"
                        min={1}
                        max={drug?.stock || 9999}
                        {...register(`items.${index}.quantity`, { valueAsNumber: true })}
                      />
                      {errors.items?.[index]?.quantity && (
                        <p className="text-sm text-destructive">{errors.items[index].quantity?.message}</p>
                      )}
                    </div>

                    {/* Unit Price */}
                    <div className="md:col-span-2 space-y-2">
                      <Label>Unit Price</Label>
                      <Input
                        type="number"
                        step="0.01"
                        {...register(`items.${index}.unitPrice`, { valueAsNumber: true })}
                      />
                      {errors.items?.[index]?.unitPrice && (
                        <p className="text-sm text-destructive">{errors.items[index].unitPrice?.message}</p>
                      )}
                    </div>

                    {/* Item Discount */}
                    <div className="md:col-span-2 space-y-2">
                      <Label>Discount</Label>
                      <Input
                        type="number"
                        step="0.01"
                        defaultValue={0}
                        {...register(`items.${index}.discount`, { valueAsNumber: true })}
                      />
                    </div>

                    {/* Batch Select */}
                    <div className="md:col-span-2 space-y-2">
                      <Label>Batch</Label>
                      <Select
                        onValueChange={(value) => setValue(`items.${index}.batchId`, value)}
                        value={watchedItems[index]?.batchId || ""}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select batch" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableBatches.length === 0 ? (
                            <SelectItem value="none" disabled>
                              No batches available
                            </SelectItem>
                          ) : (
                            availableBatches.map((batch) => {
                              const isExpired = new Date(batch.expiryDate) < new Date();
                              return (
                                <SelectItem
                                  key={batch.id}
                                  value={batch.id}
                                  disabled={isExpired}
                                >
                                  {batch.batchNumber} – Exp:{" "}
                                  {new Date(batch.expiryDate).toLocaleDateString()} (Rem:{" "}
                                  {batch.remaining})
                                  {isExpired && " (Expired)"}
                                </SelectItem>
                              );
                            })
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Remove Button */}
                    <div className="md:col-span-1 flex justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => remove(index)}
                        disabled={fields.length === 1}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}

              <Button type="button" variant="outline" onClick={() => append({ drugId: "", quantity: 1, unitPrice: 0, discount: 0 })}>
                <Plus className="mr-2 h-4 w-4" />
                Add Item
              </Button>
              {errors.items && (
                <p className="text-sm text-destructive">{errors.items.message}</p>
              )}
            </CardContent>
          </Card>

          {/* Payment & Summary Card */}
          <Card>
            <CardHeader>
              <CardTitle>Payment & Summary</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Sale Status *</Label>
                <Select onValueChange={(value: any) => setValue("status", value)} defaultValue="COMPLETED">
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="COMPLETED">Completed</SelectItem>
                    <SelectItem value="PENDING">Pending</SelectItem>
                    <SelectItem value="PARTIALLY_PAID">Partially Paid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Payment Method *</Label>
                <Select
                  onValueChange={(value: any) => setValue("paymentMethod", value)}
                  defaultValue="CASH"
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CASH">Cash</SelectItem>
                    <SelectItem value="CARD">Card</SelectItem>
                    <SelectItem value="INSURANCE">Insurance</SelectItem>
                    <SelectItem value="MIXED">Mixed</SelectItem>
                    <SelectItem value="CHAPA">Chapa (Online)</SelectItem>
                  </SelectContent>
                </Select>
                {errors.paymentMethod && (
                  <p className="text-sm text-destructive">{errors.paymentMethod.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Global Discount</Label>
                <Input
                  type="number"
                  step="0.01"
                  defaultValue={0}
                  {...register("discount", { valueAsNumber: true })}
                />
              </div>
              <div className="space-y-2">
                <Label>Tax</Label>
                <Input
                  type="number"
                  step="0.01"
                  defaultValue={0}
                  {...register("tax", { valueAsNumber: true })}
                />
              </div>
              <div className="space-y-2">
                <Label>Total</Label>
                <div className="text-2xl font-bold">
                  ${calculateTotal().toFixed(2)}
                </div>
              </div>
              <div className="md:col-span-2 space-y-2">
                <Label>Notes</Label>
                <Textarea {...register("notes")} />
              </div>
            </CardContent>
            <CardFooter className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Sale
              </Button>
            </CardFooter>
          </Card>
        </form>
      </div>

      {/* Drafts Dialog */}
      <Dialog open={draftDialogOpen} onOpenChange={setDraftDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Saved Drafts</DialogTitle>
            <DialogDescription>
              Select a draft to load. Unsaved changes will be lost.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-96 overflow-auto">
            {drafts.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">No drafts found</p>
            ) : (
              drafts.map((draft) => (
                <div key={draft.id} className="flex items-center justify-between p-2 border rounded">
                  <div>
                    <p className="font-medium">
                      {draft.data.items.length} item(s) – Total: ${draft.data.items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0).toFixed(2)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Customer: {draft.data.customerName || "Guest"} | Payment: {draft.data.paymentMethod}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => loadDraft(draft)}>
                      Load
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => deleteDraft(draft.id)}>
                      Delete
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraftDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}