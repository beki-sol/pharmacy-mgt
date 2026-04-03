import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  role: z.enum(["ADMIN", "PHARMACIST", "SALES_ASSISTANT", "MANAGER", "INVENTORY_MANAGER"]).optional(),
  isActive: z.boolean().optional(),
  resetPassword: z.boolean().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const data = updateUserSchema.parse(body);

  const updateData: any = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.phone !== undefined) updateData.phone = data.phone;
  if (data.role !== undefined) updateData.role = data.role;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;
  if (data.resetPassword) {
    updateData.password = await bcrypt.hash("password123", 12); // default password
  }

  const updated = await prisma.user.update({
    where: { id },
    data: updateData,
    select: { id: true, name: true, email: true, phone: true, role: true, isActive: true },
  });
  return NextResponse.json(updated);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  // Prevent self-deletion
  if (id === session.user.id) {
    return NextResponse.json({ error: "Cannot delete your own account" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id }, include: { sales: { take: 1 } } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Hard delete if no associated data
  if (user.sales.length === 0) {
    await prisma.user.delete({ where: { id } });
  } else {
    // Soft delete (deactivate)
    await prisma.user.update({ where: { id }, data: { isActive: false } });
  }
  return NextResponse.json({ success: true });
}