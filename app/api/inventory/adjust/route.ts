import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { z } from "zod";

// Helper to get default user ID (first admin)
async function getDefaultUserId() {
  const user = await prisma.user.findFirst({
    where: { role: "ADMIN" },
    select: { id: true },
  });
  if (!user) throw new Error("No admin user found – cannot perform adjustment");
  return user.id;
}

const adjustmentSchema = z.object({
  drugId: z.string().min(1),
  quantity: z.number().int().positive(),
  type: z.enum(["ADJUSTMENT", "DAMAGE", "RETURN"]),
  notes: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const userId = await getDefaultUserId();
    const body = await request.json();
    const data = adjustmentSchema.parse(body);

    const drug = await prisma.drug.findUnique({
      where: { id: data.drugId },
    });
    if (!drug) {
      return NextResponse.json({ error: "Drug not found" }, { status: 404 });
    }

    // Determine stock change based on type:
    // - DAMAGE: subtract (loss)
    // - RETURN: add (customer return)
    // - ADJUSTMENT: add (manual increase)
    // Note: For ADJUSTMENT, if you need to decrease stock, use DAMAGE instead.
    // The frontend sends positive quantity for all types.
    let stockChange: number;
    if (data.type === "DAMAGE") {
      stockChange = -data.quantity; // decrease
    } else {
      stockChange = data.quantity; // increase for RETURN or ADJUSTMENT
    }

    // Ensure enough stock for removal
    if (stockChange < 0 && drug.stock < Math.abs(stockChange)) {
      return NextResponse.json(
        { error: `Insufficient stock. Available: ${drug.stock}` },
        { status: 400 }
      );
    }

    const newStock = drug.stock + stockChange;

    // Perform update and create log in a transaction
    await prisma.$transaction(async (tx) => {
      await tx.drug.update({
        where: { id: data.drugId },
        data: { stock: newStock },
      });

      await tx.inventoryLog.create({
        data: {
          drugId: data.drugId,
          type: data.type,
          quantity: stockChange,
          previousStock: drug.stock,
          newStock,
          notes: data.notes,
          userId,
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /inventory/adjust error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    return NextResponse.json({ error: "Adjustment failed" }, { status: 500 });
  }
}