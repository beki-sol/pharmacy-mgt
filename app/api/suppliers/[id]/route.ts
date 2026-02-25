import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { auth } from "@/app/lib/auth";
import { headers } from "next/headers"
import { z } from "zod";

const supplierUpdateSchema = z.object({
  name: z.string().min(1, "Name is required").optional(),
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
  isActive: z.boolean().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;

    const supplier = await prisma.supplier.findUnique({
      where: { id },
      include: {
        drugs: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            genericName: true,
            category: true,
            price: true,
            stock: true,
          },
        },
        purchaseOrders: {
          orderBy: { orderDate: "desc" },
          take: 10,
          include: {
            _count: {
              select: { purchaseItems: true },
            },
          },
        },
        payments: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
        _count: {
          select: {
            drugs: true,
            purchaseOrders: true,
            payments: true,
          },
        },
      },
    });

    if (!supplier) {
      return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
    }

    return NextResponse.json(supplier);
  } catch (error: any) {
    console.error("Get supplier error:", error);
    return NextResponse.json(
      { error: "Failed to fetch supplier" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const { id } = params;
    const body = await request.json();

    const data = supplierUpdateSchema.parse({
      ...body,
      creditLimit: body.creditLimit !== undefined ? parseFloat(body.creditLimit) : undefined,
      rating: body.rating !== undefined ? parseInt(body.rating) : undefined,
    });

    const existingSupplier = await prisma.supplier.findUnique({
      where: { id },
    });

    if (!existingSupplier) {
      return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
    }

    const updatedSupplier = await prisma.$transaction(async (tx: any) => {
      const supplier = await tx.supplier.update({
        where: { id },
        data,
      });

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: "UPDATE",
          entity: "Supplier",
          entityId: id,
          oldData: existingSupplier,
          newData: supplier,
          ipAddress: request.headers.get("x-forwarded-for") || "unknown",
          userAgent: request.headers.get("user-agent") || "unknown",
        },
      });

      return supplier;
    });

    return NextResponse.json(updatedSupplier);
  } catch (error: any) {
    console.error("Update supplier error:", error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: error.message || "Failed to update supplier" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only admin can delete suppliers
    if (session.user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Only administrators can delete suppliers" },
        { status: 403 }
      );
    }

    const { id } = params;

    const supplier = await prisma.supplier.findUnique({
      where: { id },
      include: {
        drugs: { take: 1 },
        purchaseOrders: { take: 1 },
        payments: { take: 1 },
      },
    });

    if (!supplier) {
      return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
    }

    // Check if supplier has any associated records
    if (supplier.drugs.length > 0 || supplier.purchaseOrders.length > 0 || supplier.payments.length > 0) {
      // Soft delete
      await prisma.supplier.update({
        where: { id },
        data: { isActive: false },
      });

      await prisma.auditLog.create({
        data: {
          userId: session.user.id,
          action: "DEACTIVATE",
          entity: "Supplier",
          entityId: id,
          oldData: supplier,
          ipAddress: request.headers.get("x-forwarded-for") || "unknown",
          userAgent: request.headers.get("user-agent") || "unknown",
        },
      });

      return NextResponse.json({
        message: "Supplier has been deactivated because it has associated records",
      });
    }

    // Hard delete if no associations
    await prisma.$transaction(async (tx: any) => {
      await tx.supplier.delete({ where: { id } });

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: "DELETE",
          entity: "Supplier",
          entityId: id,
          oldData: supplier,
          ipAddress: request.headers.get("x-forwarded-for") || "unknown",
          userAgent: request.headers.get("user-agent") || "unknown",
        },
      });
    });

    return NextResponse.json({ message: "Supplier deleted successfully" });
  } catch (error: any) {
    console.error("Delete supplier error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete supplier" },
      { status: 500 }
    );
  }
}