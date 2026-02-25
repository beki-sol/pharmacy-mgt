
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { auth } from "@/app/lib/auth";
import { headers } from "next/headers"
import { z } from "zod";
import { initializeChapaPayment } from "@/app/lib/chapa";
import { sendTelegramToAdminGroup } from "@/app/service/telegram/service";

// Validation schemas
const saleItemSchema = z.object({
  drugId: z.string(),
  quantity: z.number().int().positive("Quantity must be positive"),
  unitPrice: z.number().positive("Unit price must be positive"),
  discount: z.number().min(0).default(0),
  batchNumber: z.string().optional(),
});

const saleSchema = z.object({
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  customerEmail: z.string().email().optional(),
  paymentMethod: z.enum(["CASH", "CARD", "INSURANCE", "MIXED", "CHAPA"]),
  items: z.array(saleItemSchema).min(1, "At least one item is required"),
  discount: z.number().min(0).default(0),
  tax: z.number().min(0).default(0),
  notes: z.string().optional(),
  isPrescription: z.boolean().default(false),
  prescriptionData: z
    .object({
      patientName: z.string().optional(),
      patientAge: z.number().optional(),
      patientGender: z.string().optional(),
      doctorName: z.string().optional(),
      diagnosis: z.string().optional(),
      prescriptionItems: z
        .array(
          z.object({
            drugId: z.string(),
            dosage: z.string(),
            frequency: z.string(),
            duration: z.string(),
            instructions: z.string().optional(),
            quantity: z.number().int().positive(),
          })
        )
        .optional(),
    })
    .optional(),
});

// GET - List sales with pagination and filters
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
    const status = searchParams.get("status");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const sortBy = searchParams.get("sortBy") || "createdAt";
    const sortOrder = searchParams.get("sortOrder") || "desc";

    const skip = (page - 1) * limit;
    let where: any = {};

    if (search) {
      where.OR = [
        { invoiceNumber: { contains: search, mode: "insensitive" } },
        { customerName: { contains: search, mode: "insensitive" } },
        { customerPhone: { contains: search, mode: "insensitive" } },
        { customerEmail: { contains: search, mode: "insensitive" } },
      ];
    }

    if (status) {
      where.status = status;
    }

    if (startDate && endDate) {
      where.createdAt = {
        gte: new Date(startDate),
        lte: new Date(endDate),
      };
    }

    const [sales, total] = await Promise.all([
      prisma.sale.findMany({
        where,
        include: {
          user: { select: { name: true, email: true } },
          saleItems: {
            include: {
              drug: { select: { name: true, genericName: true, brand: true } },
            },
          },
          prescriptions: {
            include: {
              prescriptionItems: {
                include: { drug: { select: { name: true } } },
              },
            },
          },
          payments: true, // Include payment records
        },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
      }),
      prisma.sale.count({ where }),
    ]);

    return NextResponse.json({
      sales,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error("Get sales error:", error);
    return NextResponse.json(
      { error: "Failed to fetch sales" },
      { status: 500 }
    );
  }
}

// POST - Create a new sale (supports both immediate and Chapa payments)
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const data = saleSchema.parse({
      ...body,
      items: body.items.map((item: any) => ({
        ...item,
        quantity: parseInt(item.quantity),
        unitPrice: parseFloat(item.unitPrice),
        discount: parseFloat(item.discount || 0),
      })),
      discount: parseFloat(body.discount || 0),
      tax: parseFloat(body.tax || 0),
    });

    // Generate invoice number
    const invoiceNumber = `INV-${Date.now().toString().slice(-8)}-${Math.random()
      .toString(36)
      .substr(2, 4)
      .toUpperCase()}`;

    // Calculate totals
    let subtotal = 0;
    const itemsWithSubtotals = data.items.map((item) => {
      const itemSubtotal = item.unitPrice * item.quantity - item.discount;
      subtotal += itemSubtotal;
      return { ...item, subtotal: itemSubtotal };
    });

    const totalAmount = subtotal + data.tax - data.discount;
    const netAmount = totalAmount;

    // --- Immediate payment methods (CASH, CARD, INSURANCE, MIXED) ---
    if (data.paymentMethod !== "CHAPA") {
      // Check stock availability
      for (const item of data.items) {
        const drug = await prisma.drug.findUnique({ where: { id: item.drugId } });
        if (!drug) throw new Error(`Drug with ID ${item.drugId} not found`);
        if (drug.stock < item.quantity) {
          throw new Error(
            `Insufficient stock for ${drug.name}. Available: ${drug.stock}, Requested: ${item.quantity}`
          );
        }
      }

      // Create sale with COMPLETED status and update stock
      const sale = await prisma.$transaction(async (tx: any) => {
        const newSale = await tx.sale.create({
          data: {
            invoiceNumber,
            userId: session.user.id,
            customerName: data.customerName,
            customerPhone: data.customerPhone,
            customerEmail: data.customerEmail,
            totalAmount,
            discount: data.discount,
            tax: data.tax,
            netAmount,
            paymentMethod: data.paymentMethod,
            notes: data.notes,
            isPrescription: data.isPrescription,
            status: "COMPLETED",
            saleItems: {
              create: itemsWithSubtotals.map((item) => ({
                drugId: item.drugId,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                discount: item.discount,
                tax: 0, // tax is at sale level
                subtotal: item.subtotal,
                batchNumber: item.batchNumber,
              })),
            },
          },
        });

        // Create payment record
        await tx.payment.create({
          data: {
            saleId: newSale.id,
            amount: netAmount,
            method: data.paymentMethod,
            status: "COMPLETED",
            paidAt: new Date(),
          },
        });

        // Update drug stock and create inventory logs
        for (const item of data.items) {
          const drug = await tx.drug.findUnique({ where: { id: item.drugId } });
          if (drug) {
            const newStock = drug.stock - item.quantity;
            await tx.drug.update({
              where: { id: item.drugId },
              data: { stock: newStock },
            });
            await tx.inventoryLog.create({
              data: {
                drugId: item.drugId,
                type: "SALE",
                quantity: -item.quantity,
                previousStock: drug.stock,
                newStock,
                referenceId: newSale.id,
                referenceType: "SALE",
                batchNumber: item.batchNumber,
                userId: session.user.id,
              },
            });
          }
        }

        // Create prescription if needed
        if (data.isPrescription && data.prescriptionData) {
          await tx.prescription.create({
            data: {
              prescriptionNumber: `RX-${Date.now().toString().slice(-8)}`,
              saleId: newSale.id,
              patientName: data.prescriptionData.patientName || data.customerName || "Unknown",
              patientAge: data.prescriptionData.patientAge || 0,
              patientGender: data.prescriptionData.patientGender || "Unknown",
              doctorName: data.prescriptionData.doctorName || "",
              diagnosis: data.prescriptionData.diagnosis,
              issueDate: new Date(),
              expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
              isDispensed: true,
              prescriptionItems: {
                create:
                  data.prescriptionData.prescriptionItems?.map((item) => ({
                    drugId: item.drugId,
                    dosage: item.dosage,
                    frequency: item.frequency,
                    duration: item.duration,
                    instructions: item.instructions,
                    quantity: item.quantity,
                    isDispensed: true,
                  })) || [],
              },
            },
          });
        }

        // Create audit log
        await tx.auditLog.create({
          data: {
            userId: session.user.id,
            action: "CREATE",
            entity: "Sale",
            entityId: newSale.id,
            newData: newSale,
            ipAddress: request.headers.get("x-forwarded-for") || "unknown",
            userAgent: request.headers.get("user-agent") || "unknown",
          },
        });

        return newSale;
      });

      // Check low stock and create notifications
      const lowStockDrugs = await prisma.drug.findMany({
        where: {
          stock: { lte: prisma.drug.fields.minStockLevel },
          isActive: true,
        },
      });
      if (lowStockDrugs.length > 0) {
        const message = lowStockDrugs.map((d:any) => `• ${d.name}: ${d.stock} (min ${d.minStockLevel})`).join('\n');
        await sendTelegramToAdminGroup(`<b>Low Stock Alert</b>\n\n${message}`);
     }

      for (const drug of lowStockDrugs) {
        await prisma.notification.create({
          data: {
            userId: session.user.id,
            title: "Low Stock Alert",
            message: `${drug.name} is below minimum stock level (Current: ${drug.stock}, Min: ${drug.minStockLevel})`,
            type: "WARNING",
            link: `/dashboard/drugs/${drug.id}`,
            metadata: { drugId: drug.id, currentStock: drug.stock, minStock: drug.minStockLevel },
          },
        });
      }
      

      return NextResponse.json(sale, { status: 201 });
    }

    // --- Chapa payment flow ---
    else {
      // Create sale with PENDING status (do not deduct stock yet)
      const pendingSale = await prisma.sale.create({
        data: {
          invoiceNumber,
          userId: session.user.id,
          customerName: data.customerName,
          customerPhone: data.customerPhone,
          customerEmail: data.customerEmail,
          totalAmount,
          discount: data.discount,
          tax: data.tax,
          netAmount,
          paymentMethod: "CHAPA",
          notes: data.notes,
          isPrescription: data.isPrescription,
          status: "PENDING",
          saleItems: {
            create: itemsWithSubtotals.map((item) => ({
              drugId: item.drugId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              discount: item.discount,
              tax: 0,
              subtotal: item.subtotal,
              batchNumber: item.batchNumber,
            })),
          },
        },
      });

      // Generate unique transaction reference for Chapa
      const txRef = `tx-${pendingSale.invoiceNumber}-${Date.now()}`;

      // Initialize Chapa payment
      const chapaResponse = await initializeChapaPayment({
        amount: netAmount,
        currency: "ETB",
        tx_ref: txRef,
        callback_url: `${process.env.APP_URL}/api/payments/chapa/verify`, // your webhook endpoint
        return_url: `${process.env.APP_URL}/dashboard/sales/${pendingSale.id}/status`, // redirect after payment
        customer: {
          email: data.customerEmail || "customer@example.com",
          name: data.customerName,
          
        },
      });

      if (chapaResponse.success && chapaResponse.data?.checkout_url) {
        // Create payment record with PENDING status and Chapa details
        await prisma.payment.create({
          data: {
            saleId: pendingSale.id,
            amount: netAmount,
            method: "CHAPA",
            status: "PENDING",
            chapaTxRef: txRef,
            paymentLink: chapaResponse.data.checkout_url,
          },
        });

        // Create audit log
        await prisma.auditLog.create({
          data: {
            userId: session.user.id,
            action: "CREATE",
            entity: "Sale",
            entityId: pendingSale.id,
            newData: pendingSale,
            ipAddress: request.headers.get("x-forwarded-for") || "unknown",
            userAgent: request.headers.get("user-agent") || "unknown",
          },
        });

        // Return payment link to frontend
        return NextResponse.json({
          paymentLink: chapaResponse.data.checkout_url,
          saleId: pendingSale.id,
          status: "PENDING_PAYMENT",
        });
      } else {
        // Chapa initialization failed; clean up the pending sale
        await prisma.sale.delete({ where: { id: pendingSale.id } });
        throw new Error("Failed to initialize Chapa payment");
      }
    }
  } catch (error: any) {
    console.error("Create sale error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error.message || "Failed to create sale" },
      { status: 500 }
    );
  }
} 