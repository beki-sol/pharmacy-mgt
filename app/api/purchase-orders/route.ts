import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import nodemailer from "nodemailer";
import { z } from "zod";

const orderItemSchema = z.object({
  drugId: z.string(),
  supplierId: z.string(),
  quantity: z.number().int().positive(),
});

const orderSchema = z.object({
  items: z.array(orderItemSchema).min(1),
  globalMessage: z.string().optional(),
});

// Email transporter
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT || "587"),
  secure: process.env.EMAIL_SECURE === "true",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { items, globalMessage } = orderSchema.parse(body);

    // Fetch all drugs and suppliers in one go
    const drugIds = items.map(i => i.drugId);
    const supplierIds = items.map(i => i.supplierId);
    const drugs = await prisma.drug.findMany({ where: { id: { in: drugIds } } });
    const suppliers = await prisma.supplier.findMany({ where: { id: { in: supplierIds } } });

    if (drugs.length !== items.length) {
      return NextResponse.json({ error: "Some drugs not found" }, { status: 404 });
    }

    // Group items by supplier
    const supplierMap = new Map<string, { supplier: any; items: { drug: any; quantity: number }[] }>();
    for (const item of items) {
      const drug = drugs.find(d => d.id === item.drugId);
      const supplier = suppliers.find(s => s.id === item.supplierId);
      if (!drug) return NextResponse.json({ error: `Drug not found` }, { status: 404 });
      if (!supplier) return NextResponse.json({ error: `Supplier not found` }, { status: 404 });
      if (!supplier.email) {
        return NextResponse.json({ error: `Supplier ${supplier.name} has no email` }, { status: 400 });
      }
      if (!supplierMap.has(supplier.id)) {
        supplierMap.set(supplier.id, { supplier, items: [] });
      }
      supplierMap.get(supplier.id)!.items.push({ drug, quantity: item.quantity });
    }

    // Send email to each supplier
    const emailPromises = [];
    for (const { supplier, items: supplierItems } of supplierMap.values()) {
      const itemsList = supplierItems.map(i => `- ${i.drug.name}: ${i.quantity} ${i.drug.unit}`).join('\n');
      const subject = `Purchase Order Request from Pharmacy`;
      const text = `
        Dear ${supplier.name},

        Please supply the following items:

        ${itemsList}

        ${globalMessage ? `Additional instructions: ${globalMessage}` : ''}

        Please confirm availability and delivery timeline.

        Best regards,
        ${session.user.name}
        Pharmacy Management System
      `;

      emailPromises.push(
        transporter.sendMail({
          from: process.env.EMAIL_FROM,
          to: supplier.email,
          subject,
          text,
        })
      );
    }

    await Promise.all(emailPromises);

    return NextResponse.json({ success: true, message: "Orders sent to suppliers" });
  } catch (error: any) {
    console.error("Purchase order error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: error.message || "Failed to place order" }, { status: 500 });
  }
}