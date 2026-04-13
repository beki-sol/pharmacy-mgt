import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/lib/auth";
import nodemailer from "nodemailer";
import { z } from "zod";

const orderSchema = z.object({
  drugId: z.string(),
  quantity: z.number().int().positive(),
  message: z.string().optional(),
});

// Email transporter configuration
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
    const { drugId, quantity, message } = orderSchema.parse(body);

    // Fetch drug with its supplier
    const drug = await prisma.drug.findUnique({
      where: { id: drugId },
      include: { supplier: true },
    });

    if (!drug) {
      return NextResponse.json({ error: "Drug not found" }, { status: 404 });
    }

    if (!drug.supplier) {
      return NextResponse.json(
        { error: "This drug has no supplier assigned" },
        { status: 400 }
      );
    }

    if (!drug.supplier.email) {
      return NextResponse.json(
        { error: "The supplier does not have an email address" },
        { status: 400 }
      );
    }

    // Prepare email
    const subject = `Order Request: ${drug.name}`;
    const emailText = `
      Dear ${drug.supplier.name || "Supplier"},

      This is an order request from ${session.user.name} (${session.user.email}).

      Drug: ${drug.name}
      Quantity: ${quantity} ${drug.unit}
      Current Stock: ${drug.stock}
      Min Stock Level: ${drug.minStockLevel}

      ${message ? `Additional Message: ${message}` : ""}

      Please confirm availability and delivery timeline.

      Best regards,
      Pharmacy Management System
    `;

    // Send email
    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: drug.supplier.email,
      subject,
      text: emailText,
    });

    // Optionally, log the order in the database (you can create an Order model later)
    // For now, just return success
    return NextResponse.json({ success: true, message: "Order email sent successfully" });
  } catch (error: any) {
    console.error("Order error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: error.message || "Failed to place order" }, { status: 500 });
  }
}