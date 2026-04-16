import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { z } from "zod";
import { initializeChapaPayment } from "@/app/lib/chapa";
import { sendTelegramToAdminGroup } from "@/app/service/telegram/service";
import { auth } from "@/app/lib/auth";

// Validation schemas
const saleItemSchema = z.object({
  drugId: z.string(),
  quantity: z.number().int().positive("Quantity must be positive"),
  unitPrice: z.number().positive("Unit price must be positive"),
  discount: z.number().min(0).default(0),
  batchId: z.string().optional(),
  batchNumber: z.string().optional(),
});

const saleSchema = z.object({
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  customerEmail: z.string().optional(), // no longer requires email format
  paymentMethod: z.enum(["CASH", "CARD", "INSURANCE", "MIXED", "CHAPA"]),
  status: z.enum(["COMPLETED", "PENDING", "PARTIALLY_PAID"]).default("COMPLETED"),
  items: z.array(saleItemSchema).min(1, "At least one item is required"),
  discount: z.number().min(0).default(0),
  tax: z.number().min(0).default(0),
  notes: z.string().optional(),
  isPrescription: z.boolean().default(false),
  prescriptionData: z.object({
    patientName: z.string().optional(),
    patientAge: z.number().optional(),
    patientGender: z.string().optional(),
    doctorName: z.string().optional(),
    diagnosis: z.string().optional(),
    prescriptionItems: z.array(
      z.object({
        drugId: z.string(),
        dosage: z.string(),
        frequency: z.string(),
        duration: z.string(),
        instructions: z.string().optional(),
        quantity: z.number().int().positive(),
      })
    ).optional(),
  }).optional(),
});

// GET - List sales with pagination and filters
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const search = searchParams.get("search") || "";
    let status = searchParams.get("status");
    let paymentMethod = searchParams.get("paymentMethod");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const sortBy = searchParams.get("sortBy") || "createdAt";
    const sortOrder = searchParams.get("sortOrder") || "desc";

    const skip = (page - 1) * limit;
    let where: any = {};

    if (status && status !== "ALL") where.status = status;
    if (paymentMethod && paymentMethod !== "ALL") where.paymentMethod = paymentMethod;

    if (search) {
      where.OR = [
        { invoiceNumber: { contains: search, mode: "insensitive" } },
        { customerName: { contains: search, mode: "insensitive" } },
        { customerPhone: { contains: search, mode: "insensitive" } },
        { customerEmail: { contains: search, mode: "insensitive" } },
      ];
    }

    if (startDate && endDate) {
      where.createdAt = { gte: new Date(startDate), lte: new Date(endDate) };
    }

    const [sales, total] = await Promise.all([
      prisma.sale.findMany({
        where,
        include: {
          user: { select: { name: true, email: true } },
          saleItems: {
            include: {
              drug: { select: { name: true, genericName: true, brand: true } },
              batch: true,
            },
          },
          prescriptions: {
            include: {
              prescriptionItems: {
                include: { drug: { select: { name: true } } },
              },
            },
          },
          payments: true,
        },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
      }),
      prisma.sale.count({ where }),
    ]);

    return NextResponse.json({
      sales,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error: any) {
    console.error("Get sales error:", error);
    return NextResponse.json({ error: "Failed to fetch sales" }, { status: 500 });
  }
}

// POST - Create a new sale with batch validation and status handling
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = session.user.id;

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
    const customerEmail = data.customerEmail?.trim() || "guest@pharmacy.com";

    const invoiceNumber = `INV-${Date.now().toString().slice(-8)}-${Math.random()
      .toString(36)
      .substring(2, 6)
      .toUpperCase()}`;

    const { status } = data;

    // ---------- VALIDATION (expiry and stock) ----------
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    for (const item of data.items) {
      const drug = await prisma.drug.findUnique({
        where: { id: item.drugId },
        include: {
          batches: {
            where: { remaining: { gt: 0 } },
            orderBy: { expiryDate: "asc" },
          },
        },
      });
      if (!drug) throw new Error(`Drug with ID ${item.drugId} not found`);

      if (item.batchId) {
        const batch = drug.batches.find(b => b.id === item.batchId);
        if (!batch) throw new Error(`Batch ${item.batchId} not found or empty for drug ${drug.name}`);

        // Check batch expiry
        const expiryDate = new Date(batch.expiryDate);
        expiryDate.setUTCHours(0, 0, 0, 0);
        const expiryStr = expiryDate.toISOString().split('T')[0];
        if (expiryStr < todayStr) {
          throw new Error(`Batch ${batch.batchNumber} expired on ${expiryStr}`);
        }
        if (batch.remaining < item.quantity) {
          throw new Error(
            `Insufficient stock in batch ${batch.batchNumber}. Available: ${batch.remaining}, Requested: ${item.quantity}`
          );
        }
      } else {
        // No batch selected
        if (drug.batches.length > 0) {
          throw new Error(`Please select a batch for ${drug.name}`);
        }
        // No batches – check drug's own expiry date
        if (drug.expiryDate) {
          const drugExpiry = new Date(drug.expiryDate);
          drugExpiry.setUTCHours(0, 0, 0, 0);
          const drugExpiryStr = drugExpiry.toISOString().split('T')[0];
          if (drugExpiryStr < todayStr) {
            throw new Error(`Drug ${drug.name} expired on ${drugExpiryStr}`);
          }
        }
        // Only check total stock if status is COMPLETED
        if (status === "COMPLETED" && drug.stock < item.quantity) {
          throw new Error(
            `Insufficient stock for ${drug.name}. Available: ${drug.stock}, Requested: ${item.quantity}`
          );
        }
      }
    }

    // ---------- TOTALS ----------
    let subtotal = 0;
    const itemsWithSubtotals = data.items.map((item) => {
      const itemSubtotal = item.unitPrice * item.quantity - item.discount;
      subtotal += itemSubtotal;
      return { ...item, subtotal: itemSubtotal };
    });

    const totalAmount = subtotal + data.tax - data.discount;
    const netAmount = totalAmount;

    // ---------- IMMEDIATE PAYMENT (non-Chapa) ----------
    if (data.paymentMethod !== "CHAPA") {
      const sale = await prisma.$transaction(async (tx) => {
        const newSale = await tx.sale.create({
          data: {
            invoiceNumber,
            userId,
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
            status,
            saleItems: {
              create: itemsWithSubtotals.map((item) => ({
                drugId: item.drugId,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                discount: item.discount,
                tax: 0,
                subtotal: item.subtotal,
                batchId: item.batchId,
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
            status: status === "COMPLETED" ? "COMPLETED" : "PENDING",
            paidAt: status === "COMPLETED" ? new Date() : null,
          },
        });

        // Only deduct stock if status is COMPLETED
        if (status === "COMPLETED") {
          for (const item of data.items) {
            const drug = await tx.drug.findUnique({ where: { id: item.drugId } });
            if (!drug) continue;

            const newStock = drug.stock - item.quantity;
            await tx.drug.update({
              where: { id: item.drugId },
              data: { stock: newStock },
            });

            if (item.batchId) {
              const batch = await tx.drugBatch.findUnique({ where: { id: item.batchId } });
              if (batch) {
                const newRemaining = batch.remaining - item.quantity;
                await tx.drugBatch.update({
                  where: { id: item.batchId },
                  data: { remaining: newRemaining },
                });
              }
            }

            await tx.inventoryLog.create({
              data: {
                drugId: item.drugId,
                type: "SALE",
                quantity: -item.quantity,
                previousStock: drug.stock,
                newStock,
                saleId: newSale.id,
                batchNumber: item.batchNumber,
                userId,
              },
            });
          }
        }


        // Prescription creation
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
        

        return newSale;
      });

      // Low stock alerts (run regardless of status)
      const lowStockDrugs = await prisma.drug.findMany({
        where: {
          stock: { lte: prisma.drug.fields.minStockLevel },
          isActive: true,
        },
      });
      if (lowStockDrugs.length > 0) {
        const message = lowStockDrugs.map((d) => `• ${d.name}: ${d.stock} (min ${d.minStockLevel})`).join('\n');
        await sendTelegramToAdminGroup(`<b>Low Stock Alert</b>\n\n${message}`);
      }
      for (const drug of lowStockDrugs) {
        await prisma.notification.create({
          data: {
            userId,
            title: "Low Stock Alert",
            message: `${drug.name} is below minimum stock level (Current: ${drug.stock}, Min: ${drug.minStockLevel})`,
            type: "WARNING",
            link: `/dashboard/drugs/${drug.id}`,
          },
        });
      }

      return NextResponse.json(sale, { status: 201 });
    }

    // ---------- CHAPA PAYMENT FLOW (always PENDING, no stock deduction) ----------
    else {
      const pendingSale = await prisma.sale.create({
        data: {
          invoiceNumber,
          userId,
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
          status: "PENDING", // force pending
          saleItems: {
            create: itemsWithSubtotals.map((item) => ({
              drugId: item.drugId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              discount: item.discount,
              tax: 0,
              subtotal: item.subtotal,
              batchId: item.batchId,
              batchNumber: item.batchNumber,
            })),
          },
        },
      });

      const txRef = `tx-${pendingSale.invoiceNumber}-${Date.now()}`;
      // ---------- CHAPA PAYMENT FLOW ----------
const chapaResult = await initializeChapaPayment({
  amount: netAmount,
  currency: "ETB",
  tx_ref: txRef,
  callback_url: "http://localhost:3000/api/payment/chapa/verify",
  return_url: `http://localhost:3000/dashboard/sales/${pendingSale.id}/status`,
  email: customerEmail,          // already using customerEmail from sale data
  first_name: data.customerName?.split(' ')[0] || "Customer",
  last_name: data.customerName?.split(' ').slice(1).join(' ') || "",
  phone_number: data.customerPhone || "0000000000",
});

if (chapaResult.success && chapaResult.checkout_url) {
  await prisma.payment.create({
    data: {
      saleId: pendingSale.id,
      amount: netAmount,
      method: "CHAPA",
      status: "PENDING",
      chapaTxRef: txRef,
      paymentLink: chapaResult.checkout_url,
    },
  });
  console.log("tx_ref: ",txRef);

  return NextResponse.json({
    paymentLink: chapaResult.checkout_url,
    saleId: pendingSale.id,
    status: "PENDING_PAYMENT",
  });
} else {
  await prisma.sale.delete({ where: { id: pendingSale.id } });
  throw new Error(chapaResult.error || "Failed to initialize Chapa payment");
}
    }
  } catch (error: any) {
    console.error("Create sale error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: error.message || "Failed to create sale" }, { status: 500 });
  }
}