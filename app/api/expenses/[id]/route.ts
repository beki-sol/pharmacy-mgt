import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { auth } from "@/app/lib/auth";
import { z } from "zod";

const updateSchema = z.object({
  category: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  amount: z.number().positive().optional(),
  date: z.string().datetime().optional(),
  notes: z.string().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const data = updateSchema.parse({
      ...body,
      amount: body.amount ? parseFloat(body.amount) : undefined,
    });

    const expense = await prisma.expense.update({
      where: { id: params.id },
      data: {
        ...data,
        date: data.date ? new Date(data.date) : undefined,
      },
    });

    return NextResponse.json(expense);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("PATCH expense error:", error);
    return NextResponse.json({ error: "Failed to update expense" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.expense.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE expense error:", error);
    return NextResponse.json({ error: "Failed to delete expense" }, { status: 500 });
  }
}