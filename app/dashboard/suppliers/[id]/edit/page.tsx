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
import { Switch } from "@/app/components/ui/Switch";
import { Loader2, AlertTriangle } from "lucide-react";
import toast from "react-hot-toast";

const supplierFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  company: z.string().optional(),
  contactPerson: z.string().optional(),
  email: z.string().email("Invalid email address").optional().or(z.literal("")),
  phone: z.string().optional(),
  address: z.string().optional(),
  taxId: z.string().optional(),
  paymentTerms: z.string().optional(),
  creditLimit: z.number().positive("Credit limit must be positive").optional().nullable(),
  rating: z.number().int().min(1).max(5).optional().nullable(),
  notes: z.string().optional(),
  isActive: z.boolean(),
});

type SupplierFormData = z.infer<typeof supplierFormSchema>;

export default function EditSupplierPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

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
  } = useForm<SupplierFormData>({
    resolver: zodResolver(supplierFormSchema),
    defaultValues: {
      isActive: true,
    },
  });

  const isActive = watch("isActive");

  // Fetch supplier data
  useEffect(() => {
    const fetchSupplier = async () => {
      try {
        const res = await fetch(`/api/suppliers/${id}`);
        if (!res.ok) {
          if (res.status === 404) throw new Error("Supplier not found");
          throw new Error("Failed to load supplier");
        }
        const data = await res.json();

        // Pre‑fill form with existing data
        reset({
          name: data.name,
          company: data.company || "",
          contactPerson: data.contactPerson || "",
          email: data.email || "",
          phone: data.phone || "",
          address: data.address || "",
          taxId: data.taxId || "",
          paymentTerms: data.paymentTerms || "",
          creditLimit: data.creditLimit,
          rating: data.rating,
          notes: data.notes || "",
          isActive: data.isActive,
        });
      } catch (err: any) {
        setError(err.message);
        toast.error(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchSupplier();
  }, [id, reset]);

  const onSubmit = async (data: SupplierFormData) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/suppliers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || "Failed to update supplier");
      }
      toast.success("Supplier updated successfully");
      router.push(`/dashboard/suppliers/${id}`);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <>
        <Header title="Edit Supplier" />
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
      <Header title="Edit Supplier" subtitle="Update supplier information" />
      <div className="p-6 max-w-4xl mx-auto">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
              <CardDescription>Edit the supplier's details</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Supplier Name *</Label>
                <Input id="name" {...register("name")} />
                {errors.name && (
                  <p className="text-sm text-destructive">{errors.name.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="company">Company Name</Label>
                <Input id="company" {...register("company")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactPerson">Contact Person</Label>
                <Input id="contactPerson" {...register("contactPerson")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" {...register("email")} />
                {errors.email && (
                  <p className="text-sm text-destructive">{errors.email.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" {...register("phone")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="taxId">Tax ID / VAT Number</Label>
                <Input id="taxId" {...register("taxId")} />
              </div>
              <div className="md:col-span-2 space-y-2">
                <Label htmlFor="address">Address</Label>
                <Textarea id="address" {...register("address")} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Business Terms</CardTitle>
              <CardDescription>Payment and credit information</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="paymentTerms">Payment Terms</Label>
                <Input
                  id="paymentTerms"
                  placeholder="e.g., Net 30"
                  {...register("paymentTerms")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="creditLimit">Credit Limit ($)</Label>
                <Input
                  id="creditLimit"
                  type="number"
                  step="0.01"
                  {...register("creditLimit", { valueAsNumber: true })}
                />
                {errors.creditLimit && (
                  <p className="text-sm text-destructive">{errors.creditLimit.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="rating">Rating (1‑5)</Label>
                <Select
                  onValueChange={(value) => setValue("rating", value ? parseInt(value) : null)}
                  defaultValue={watch("rating")?.toString()}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select rating" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 Star</SelectItem>
                    <SelectItem value="2">2 Stars</SelectItem>
                    <SelectItem value="3">3 Stars</SelectItem>
                    <SelectItem value="4">4 Stars</SelectItem>
                    <SelectItem value="5">5 Stars</SelectItem>
                  </SelectContent>
                </Select>
                {errors.rating && (
                  <p className="text-sm text-destructive">{errors.rating.message}</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Additional Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea id="notes" {...register("notes")} />
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
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
              >
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