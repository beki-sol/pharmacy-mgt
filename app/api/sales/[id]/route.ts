import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const sale = await prisma.sale.findUnique({
      where: { id },
      include: {
        user: { select: { name: true, email: true } },
        //customer: true, // if you have a customer model; otherwise remove
        saleItems: {
          include: {
            drug: { select: { name: true, genericName: true, unit: true } },
          },
        },
        payments: true,
        prescriptions: {
          include: {
            prescriptionItems: {
              include: { drug: { select: { name: true } } },
            },
          },
        },
      },
    });

    if (!sale) {
      return NextResponse.json({ error: "Sale not found" }, { status: 404 });
    }

    // Convert Decimals to numbers
    const converted = JSON.parse(JSON.stringify(sale, (key, value) =>
      typeof value === "object" && value !== null && "toNumber" in value
        ? value.toNumber()
        : value
    ));

    return NextResponse.json(converted);
  } catch (error) {
    console.error("GET sale error:", error);
    return NextResponse.json({ error: "Failed to fetch sale" }, { status: 500 });
  }
}