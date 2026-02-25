import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { auth } from "@/app/lib/auth";
import { z } from "zod";

const expenseSchema = z.object({
  category: z.string().min(1),
  description: z.string().min(1),
  amount: z.number().positive(),
  date: z.string().datetime(),
  notes: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const category = searchParams.get("category");

    const skip = (page - 1) * limit;
    let where: any = {};

    if (startDate && endDate) {
      where.date = { gte: new Date(startDate), lte: new Date(endDate) };
    }
    if (category && category !== "ALL") where.category = category;

    const [expenses, total] = await Promise.all([
      prisma.expense.findMany({
        where,
        orderBy: { date: "desc" },
        skip,
        take: limit,
      }),
      prisma.expense.count({ where }),
    ]);

    return NextResponse.json({
      expenses,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("GET expenses error:", error);
    return NextResponse.json({ error: "Failed to fetch expenses" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const data = expenseSchema.parse({
      ...body,
      amount: parseFloat(body.amount),
    });

    const expense = await prisma.expense.create({
      data: {
        ...data,
        date: new Date(data.date),
        approvedBy: session.user.id,
      },
    });

    return NextResponse.json(expense, { status: 201 });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("POST expenses error:", error);
    return NextResponse.json({ error: "Failed to create expense" }, { status: 500 });
  }
}