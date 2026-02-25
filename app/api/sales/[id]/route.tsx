import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { auth } from "@/app/lib/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sale = await prisma.sale.findUnique({
      where: { id: params.id },
      include: {
        user: { select: { name: true } },
        saleItems: {
          include: {
            drug: { select: { name: true, genericName: true } },
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

    return NextResponse.json(sale);
  } catch (error) {
    console.error("Get sale error:", error);
    return NextResponse.json(
      { error: "Failed to fetch sale" },
      { status: 500 }
    );
  }
}