import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { auth } from "@/app/lib/auth";
import { headers } from "next/headers"
import { z } from "zod";

const supplierSchema = z.object({
  name: z.string().min(1, "Name is required"),
  company: z.string().optional(),
  contactPerson: z.string().optional(),
  email: z.string().email("Invalid email").optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  taxId: z.string().optional(),
  paymentTerms: z.string().optional(),
  creditLimit: z.number().positive().optional(),
  rating: z.number().int().min(1).max(5).optional(),
  notes: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const search = searchParams.get("search") || "";
    const isActive = searchParams.get("isActive") !== "false";

    const skip = (page - 1) * limit;
    
    let where: any = { isActive };
    
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { company: { contains: search, mode: "insensitive" } },
        { contactPerson: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phone: { contains: search, mode: "insensitive" } },
      ];
    }

    const [suppliers, total] = await Promise.all([
      prisma.supplier.findMany({
        where,
        include: {
          _count: {
            select: {
              drugs: true,
              purchaseOrders: true,
            },
          },
        },
        orderBy: { name: "asc" },
        skip,
        take: limit,
      }),
      prisma.supplier.count({ where }),
    ]);

    return NextResponse.json({
      suppliers,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error("Get suppliers error:", error);
    return NextResponse.json(
      { error: "Failed to fetch suppliers" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check permissions
    if (!["ADMIN", "MANAGER", "INVENTORY_MANAGER"].includes(session.user.role)) {
      return NextResponse.json(
        { error: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const data = supplierSchema.parse({
      ...body,
      creditLimit: body.creditLimit ? parseFloat(body.creditLimit) : undefined,
      rating: body.rating ? parseInt(body.rating) : undefined,
    });

    const supplier = await prisma.$transaction(async (tx: any) => {
      const newSupplier = await tx.supplier.create({
        data: {
          ...data,
          balance: 0,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: "CREATE",
          entity: "Supplier",
          entityId: newSupplier.id,
          newData: newSupplier,
          ipAddress: request.headers.get("x-forwarded-for") || "unknown",
          userAgent: request.headers.get("user-agent") || "unknown",
        },
      });

      return newSupplier;
    });

    return NextResponse.json(supplier, { status: 201 });
  } catch (error: any) {
    console.error("Create supplier error:", error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: error.message || "Failed to create supplier" },
      { status: 500 }
    );
  }
}
