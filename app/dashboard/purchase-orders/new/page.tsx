"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Header } from "@/app/components/dashboard/Header";
import { Button } from "@/app/components/ui/Button";
import { Input } from "@/app/components/ui/Input";
import { Label } from "@/app/components/ui/Label";
import { Textarea } from "@/app/components/ui/Textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/app/components/ui/Card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/Select";
import { Plus, Trash2, Loader2, Send } from "lucide-react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";

interface Drug {
  id: string;
  name: string;
  unit: string;
  stock: number;
  supplierId?: string;
}

interface Supplier {
  id: string;
  name: string;
  email: string | null;
}

const itemSchema = z.object({
  drugId: z.string().min(1, "Drug is required"),
  supplierId: z.string().min(1, "Supplier is required"),
  quantity: z.number().int().positive("Quantity must be positive"),
});

const orderSchema = z.object({
  items: z.array(itemSchema).min(1, "At least one item is required"),
  globalMessage: z.string().optional(),
});

type OrderForm = z.infer<typeof orderSchema>;

export default function NewPurchaseOrderPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialDrugId = searchParams.get("drugId");

  const [drugs, setDrugs] = useState<Drug[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const { register, control, handleSubmit, watch, setValue, formState: { errors } } = useForm<OrderForm>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      items: initialDrugId ? [{ drugId: initialDrugId, supplierId: "", quantity: 1 }] : [{ drugId: "", supplierId: "", quantity: 1 }],
      globalMessage: "",
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const watchedItems = watch("items");

  // Load drugs and suppliers
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [drugsRes, suppliersRes] = await Promise.all([
          fetch("/api/drug?limit=1000"),
          fetch("/api/suppliers?limit=1000"),
        ]);
        const drugsData = await drugsRes.json();
        const suppliersData = await suppliersRes.json();
        setDrugs(drugsData.drugs || []);
        setSuppliers(suppliersData.suppliers || []);
      } catch (error) {
        toast.error("Failed to load data");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // When drug changes, auto-fill its default supplier
  const handleDrugChange = (index: number, drugId: string) => {
    setValue(`items.${index}.drugId`, drugId);
    const drug = drugs.find(d => d.id === drugId);
    if (drug && drug.supplierId) {
      setValue(`items.${index}.supplierId`, drug.supplierId);
    } else {
      setValue(`items.${index}.supplierId`, "");
    }
  };

  const getDrugById = (id: string) => drugs.find(d => d.id === id);
  const getSupplierById = (id: string) => suppliers.find(s => s.id === id);

  const onSubmit = async (data: OrderForm) => {
    // Validate each item has a supplier with email
    for (const item of data.items) {
      const supplier = getSupplierById(item.supplierId);
      if (!supplier || !supplier.email) {
        toast.error(`Supplier for ${getDrugById(item.drugId)?.name} has no email address.`);
        return;
      }
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/purchase-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to place order");
      toast.success("Orders sent to suppliers");
      router.push("/dashboard/purchase-orders");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <>
        <Header title="New Purchase Order" />
        <div className="p-6 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </>
    );
  }

  return (
    <>
      <Header title="New Purchase Order" subtitle="Create an order for multiple drugs and suppliers" />
      <div className="p-6 max-w-5xl mx-auto">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Order Items</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {fields.map((field, index) => {
                const drugId = watchedItems[index]?.drugId;
                const drug = getDrugById(drugId);
                const supplierId = watchedItems[index]?.supplierId;
                const supplier = getSupplierById(supplierId);
                return (
                  <div key={field.id} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end border-b pb-4">
                    <div>
                      <Label>Drug *</Label>
                      <Select
                        onValueChange={(value) => handleDrugChange(index, value)}
                        defaultValue={drugId}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select drug" />
                        </SelectTrigger>
                        <SelectContent>
                          {drugs.map((d) => (
                            <SelectItem key={d.id} value={d.id}>
                              {d.name} (Stock: {d.stock})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {errors.items?.[index]?.drugId && (
                        <p className="text-sm text-destructive">{errors.items[index].drugId?.message}</p>
                      )}
                    </div>
                    <div>
                      <Label>Supplier *</Label>
                      <Select
                        onValueChange={(value) => setValue(`items.${index}.supplierId`, value)}
                        value={supplierId}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select supplier" />
                        </SelectTrigger>
                        <SelectContent>
                          {suppliers.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.name} {!s.email && "(No email)"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {errors.items?.[index]?.supplierId && (
                        <p className="text-sm text-destructive">{errors.items[index].supplierId?.message}</p>
                      )}
                    </div>
                    <div>
                      <Label>Quantity *</Label>
                      <Input
                        type="number"
                        min={1}
                        {...register(`items.${index}.quantity`, { valueAsNumber: true })}
                      />
                      {errors.items?.[index]?.quantity && (
                        <p className="text-sm text-destructive">{errors.items[index].quantity?.message}</p>
                      )}
                    </div>
                    <div className="flex justify-end">
                      <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} disabled={fields.length === 1}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    {drug && supplier && (
                      <div className="md:col-span-4 text-sm text-muted-foreground -mt-2">
                        Ordering {watchedItems[index]?.quantity} {drug.unit} of {drug.name} from {supplier.name}
                      </div>
                    )}
                  </div>
                );
              })}
              <Button type="button" variant="outline" onClick={() => append({ drugId: "", supplierId: "", quantity: 1 })}>
                <Plus className="mr-2 h-4 w-4" /> Add Item
              </Button>
              {errors.items && <p className="text-sm text-destructive">{errors.items.message}</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Global Message (Optional)</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                {...register("globalMessage")}
                placeholder="Add instructions for all suppliers (e.g., urgent delivery, payment terms, etc.)"
                rows={4}
              />
            </CardContent>
          </Card>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Send className="mr-2 h-4 w-4" />
              Send Orders
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}