import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
export async function GET(request: NextRequest) {
  const txRef = request.nextUrl.searchParams.get('tx_ref');

  if (!txRef) {
    return NextResponse.json({ error: 'Missing tx_ref' }, { status: 400 });
  }

  const payment = await prisma.payment.findUnique({
    where: { chapaTxRef: txRef },
    select: { status: true },
  });

  return NextResponse.json({ status: payment?.status || 'NOT_FOUND' });
}