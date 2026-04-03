import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";

const profileUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(6).optional(),
  twoFactorEnabled: z.boolean().optional(),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      twoFactorEnabled: true,
      isActive: true,
      createdAt: true,
    },
  });
  return NextResponse.json(user);
}

export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const data = profileUpdateSchema.parse(body);

  const updateData: any = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.phone !== undefined) updateData.phone = data.phone;
  if (data.twoFactorEnabled !== undefined) updateData.twoFactorEnabled = data.twoFactorEnabled;

  // Only handle password change if newPassword is provided and not empty
  const newPassword = data.newPassword?.trim();
  if (newPassword && newPassword.length > 0) {
    if (!data.currentPassword || data.currentPassword.trim().length === 0) {
      return NextResponse.json({ error: "Current password is required to change password" }, { status: 400 });
    }
    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
    const isValid = await bcrypt.compare(data.currentPassword, user.password);
    if (!isValid) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
    }
    updateData.password = await bcrypt.hash(newPassword, 12);
  }

  const updated = await prisma.user.update({
    where: { id: session.user.id },
    data: updateData,
    select: { id: true, name: true, email: true, phone: true, role: true, twoFactorEnabled: true, isActive: true },
  });
  return NextResponse.json(updated);
}