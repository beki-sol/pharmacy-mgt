import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { z } from "zod";

// Helper to convert Decimal to number (and handle BigInt)
function convertDecimal(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "bigint") return Number(obj);
  if (typeof obj === "object" && "toNumber" in obj) return obj.toNumber();
  if (Array.isArray(obj)) return obj.map(convertDecimal);
  if (typeof obj === "object") {
    const result: any = {};
    for (const key in obj) result[key] = convertDecimal(obj[key]);
    return result;
  }
  return obj;
}

// Helper to get default user ID (first admin) – for approvedBy
async function getDefaultUserId() {
  const user = await prisma.user.findFirst({
    where: { role: "ADMIN" },
    select: { id: true },
  });
  if (!user) throw new Error("No admin user found – cannot create expense");
  return user.id;
}

const expenseSchema = z.object({
  category: z.string().min(1),
  description: z.string().min(1),
  amount: z.number().positive(),
  date: z.string().datetime(),
  notes: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
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

    // Convert Decimal amounts to numbers
    const convertedExpenses = expenses.map(e => ({
      ...e,
      amount: e.amount ? Number(e.amount) : 0,
    }));

    return NextResponse.json({
      expenses: convertedExpenses,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("GET expenses error:", error);
    return NextResponse.json({ error: "Failed to fetch expenses" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getDefaultUserId(); // for approvedBy
    const body = await request.json();
    const data = expenseSchema.parse({
      ...body,
      amount: parseFloat(body.amount),
    });

    const expense = await prisma.expense.create({
      data: {
        ...data,
        date: new Date(data.date),
        approvedBy: userId,
      },
    });

    // Convert amount to number
    return NextResponse.json({
      ...expense,
      amount: expense.amount ? Number(expense.amount) : 0,
    }, { status: 201 });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("POST expenses error:", error);
    return NextResponse.json({ error: "Failed to create expense" }, { status: 500 });
  }
}