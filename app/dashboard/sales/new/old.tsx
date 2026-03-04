"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/app/components/dashboard/Header";
import { Button } from "@/app/components/ui/Button";
import { Input } from "@/app/components/ui/Input";
import { Label } from "@/app/components/ui/Label";
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
import { Plus, Trash, Loader2 } from "lucide-react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";

// Validation schema (same as API but without paymentMethod for now)
const saleItemSchema = z.object({
  drugId: z.string().min(1, "Drug is required"),
  quantity: z.number().int().positive("Quantity must be positive"),
  unitPrice: z.number().positive("Price must be positive"),
  discount: z.number().min(0),
  batchNumber: z.string().optional(),
});

const saleFormSchema = z.object({
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  customerEmail: z
  .string()
  .optional()
  .refine(val => !val || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val), {
    message: "Invalid email",
  }),

  paymentMethod: z.enum(["CASH", "CARD", "INSURANCE", "MIXED", "CHAPA"]),
  items: z.array(saleItemSchema).min(1, "At least one item required"),
  discount: z.number().min(0),
  tax: z.number().min(0),
  notes: z.string().optional(),
  isPrescription: z.boolean(),
});

type SaleFormData = z.infer<typeof saleFormSchema>;

interface Drug {
  id: string;
  name: string;
  price: number;
  stock: number;
}

export default function NewSalePage() {
  const router = useRouter();
  const [drugs, setDrugs] = useState<Drug[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const paymentMethods = ["CASH", "CARD", "INSURANCE", "MIXED", "CHAPA"] as const;
  type PaymentMethod = typeof paymentMethods[number];


  const {
    register,
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<SaleFormData>({
    resolver: zodResolver(saleFormSchema),
    defaultValues: {
      items: [{ drugId: "", quantity: 1, unitPrice: 0, discount: 0 }],
      discount: 0,
      tax: 0,
      paymentMethod: "CASH",
      isPrescription: false,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "items",
  });

  const watchedItems = watch("items");
  const discount = watch("discount");
  const tax = watch("tax");

  // Calculate totals
  const subtotal = watchedItems.reduce(
    (sum, item) => sum + (item.unitPrice * item.quantity - item.discount),
    0
  );
  const total = subtotal + tax - discount;

  // Fetch drugs for dropdown
  useEffect(() => {
    const fetchDrugs = async () => {
      try {
        const res = await fetch("/api/drug?limit=100");
        const data = await res.json();
        setDrugs(data.drugs || []);
      } catch (error) {
        toast.error("Failed to load drugs");
      }
    };
    fetchDrugs();
  }, []);

  // When drug changes, auto-fill price
  const handleDrugChange = (index: number, drugId: string) => {
    const drug = drugs.find((d) => d.id === drugId);
    if (drug) {
      setValue(`items.${index}.unitPrice`, drug.price);
      // Optionally check stock
      if (drug.stock < (watchedItems[index]?.quantity || 1)) {
        toast.error(`Only ${drug.stock} in stock`);
      }
    }
  };

  const onSubmit = async (data: SaleFormData) => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error || "Failed to create sale");
      }

      // Handle Chapa redirect
      if (data.paymentMethod === "CHAPA" && result.paymentLink) {
        window.location.href = result.paymentLink;
      } else {
        toast.success("Sale completed successfully");
        router.push("/dashboard/sales");
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Header title="New Sale" subtitle="Create a new sales transaction" />
      <div className="p-6 max-w-4xl mx-auto">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Customer Info */}
          <Card>
            <CardHeader>
              <CardTitle>Customer Information</CardTitle>
              <CardDescription>Optional customer details</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="customerName">Name</Label>
                <Input id="customerName" {...register("customerName")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customerPhone">Phone</Label>
                <Input id="customerPhone" {...register("customerPhone")} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="customerEmail">Email</Label>
                <Input id="customerEmail" type="email" {...register("customerEmail")} />
              </div>
            </CardContent>
          </Card>

          {/* Items */}
          <Card>
            <CardHeader>
              <CardTitle>Items</CardTitle>
              <CardDescription>Add products to sell</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {fields.map((field, index) => (
                <div key={field.id} className="flex gap-2 items-start border-b pb-4">
                  <div className="flex-1">
                    <Select
                        onValueChange={(value) => {
                            setValue(`items.${index}.drugId`, value);
                            handleDrugChange(index, value);
                        }}
                        value={watchedItems[index]?.drugId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select drug" />
                      </SelectTrigger>
                      <SelectContent>
                        {drugs.map((drug) => (
                          <SelectItem key={drug.id} value={drug.id}>
                            {drug.name} (${drug.price}) - Stock: {drug.stock}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-24">
                    <Input
                      type="number"
                      placeholder="Qty"
                      {...register(`items.${index}.quantity`, { valueAsNumber: true })}
                    />
                  </div>
                  <div className="w-28">
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Price"
                      {...register(`items.${index}.unitPrice`, { valueAsNumber: true })}
                    />
                  </div>
                  <div className="w-28">
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Disc"
                      {...register(`items.${index}.discount`, { valueAsNumber: true })}
                    />
                  </div>
                  <div className="w-32">
                    <Input
                      placeholder="Batch"
                      {...register(`items.${index}.batchNumber`)}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => remove(index)}
                    disabled={fields.length === 1}
                  >
                    <Trash className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                onClick={() => append({ drugId: "", quantity: 1, unitPrice: 0, discount: 0 })}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Item
              </Button>
              {errors.items && (
                <p className="text-sm text-destructive">{errors.items.message}</p>
              )}
            </CardContent>
          </Card>

          {/* Payment & Totals */}
          <Card>
            <CardHeader>
              <CardTitle>Payment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Payment Method</Label>
                  <Select
                    onValueChange={(value:  PaymentMethod) => setValue("paymentMethod", value)}
                    value={watch("paymentMethod")}
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
                </div>
                <div className="space-y-2">
                  <Label htmlFor="discount">Discount ($)</Label>
                  <Input
                    id="discount"
                    type="number"
                    step="0.01"
                    {...register("discount", { valueAsNumber: true })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tax">Tax ($)</Label>
                  <Input
                    id="tax"
                    type="number"
                    step="0.01"
                    {...register("tax", { valueAsNumber: true })}
                  />
                </div>
              </div>

              <div className="border-t pt-4 space-y-2">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span className="font-semibold">${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Discount:</span>
                  <span className="font-semibold">-${discount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Tax:</span>
                  <span className="font-semibold">+${tax.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold">
                  <span>Total:</span>
                  <span>${total.toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Complete Sale
              </Button>
            </CardFooter>
          </Card>
        </form>
      </div>
    </>
  );
}