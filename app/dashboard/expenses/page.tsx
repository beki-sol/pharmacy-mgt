"use client";

import { useEffect, useState } from "react";
import { Header } from "@/app/components/dashboard/Header";
import { Button } from "@/app/components/ui/Button";
import { Input } from "@/app/components/ui/Input";
import { Label } from "@/app/components/ui/Label";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/Select";
import { Plus, Edit, Trash, CalendarIcon } from "lucide-react";
import { formatCurrency, formatDate } from "@/app/lib/utils";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { Calendar } from "@/app/components/ui/Calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/app/components/ui/Popover";
import { cn } from "@/app/lib/utils";

const expenseSchema = z.object({
  category: z.string().min(1),
  description: z.string().min(1),
  amount: z.number().positive(),
  date: z.date(),
  notes: z.string().optional(),
});

type ExpenseForm = z.infer<typeof expenseSchema>;

const categories = [
  "RENT",
  "UTILITIES",
  "SALARY",
  "MAINTENANCE",
  "SUPPLIES",
  "MARKETING",
  "TAX",
  "OTHER",
];

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 0 });
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<ExpenseForm>({
    resolver: zodResolver(expenseSchema),
    defaultValues: { date: new Date() },
  });

  const selectedDate = watch("date");

  useEffect(() => {
    fetchExpenses();
  }, [pagination.page]);

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/expenses?page=${pagination.page}&limit=${pagination.limit}`);
      const data = await res.json();
      setExpenses(data.expenses || []);
      setPagination(data.pagination || { page: 1, limit: 10, total: 0, pages: 0 });
    } catch (error) {
      toast.error("Failed to load expenses");
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: ExpenseForm) => {
    setSubmitting(true);
    try {
      const url = editingExpense ? `/api/expenses/${editingExpense.id}` : "/api/expenses";
      const method = editingExpense ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) throw new Error("Failed to save");

      toast.success(editingExpense ? "Expense updated" : "Expense added");
      setIsAddOpen(false);
      setEditingExpense(null);
      reset({ date: new Date() });
      fetchExpenses();
    } catch (error) {
      toast.error("Operation failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure?")) return;
    try {
      const res = await fetch(`/api/expenses/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Deleted");
      fetchExpenses();
    } catch {
      toast.error("Delete failed");
    }
  };

  const openEdit = (expense: any) => {
    setEditingExpense(expense);
    setValue("category", expense.category);
    setValue("description", expense.description);
    setValue("amount", expense.amount);
    setValue("date", new Date(expense.date));
    setValue("notes", expense.notes || "");
    setIsAddOpen(true);
  };

  return (
    <>
      <Header
        title="Expenses"
        subtitle="Manage operational expenses"
        actions={
          <Dialog open={isAddOpen} onOpenChange={(open) => {
            setIsAddOpen(open);
            if (!open) {
              setEditingExpense(null);
              reset({ date: new Date() });
            }
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Expense
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingExpense ? "Edit Expense" : "Add Expense"}</DialogTitle>
                <DialogDescription>Enter expense details</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select
                    onValueChange={(v) => setValue("category", v)}
                    defaultValue={editingExpense?.category}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map(cat => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.category && <p className="text-sm text-destructive">{errors.category.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input {...register("description")} />
                  {errors.description && <p className="text-sm text-destructive">{errors.description.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Amount</Label>
                  <Input type="number" step="0.01" {...register("amount", { valueAsNumber: true })} />
                  {errors.amount && <p className="text-sm text-destructive">{errors.amount.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn("w-full justify-start text-left font-normal", !selectedDate && "text-muted-foreground")}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {selectedDate ? formatDate(selectedDate) : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={(date) => date && setValue("date", date)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  {errors.date && <p className="text-sm text-destructive">{errors.date.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Notes (optional)</Label>
                  <Input {...register("notes")} />
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={submitting}>
                    {submitting ? "Saving..." : "Save"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Expense List</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Loading...</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses.map((exp) => (
                    <TableRow key={exp.id}>
                      <TableCell>{formatDate(exp.date)}</TableCell>
                      <TableCell><Badge variant="outline">{exp.category}</Badge></TableCell>
                      <TableCell>{exp.description}</TableCell>
                      <TableCell>{formatCurrency(exp.amount)}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(exp)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(exp.id)}>
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
      </div>
    </>
  );
}