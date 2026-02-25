import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const headers = Object.fromEntries(request.headers);
    const signature = headers['x-chapa-signature'] as string | undefined;

    // Ensure required fields are present
    if (!body.event || !body.tx_ref || !body.id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const payload = JSON.stringify(body);

    // 1. Verify the webhook signature (security)
    const hash = crypto
      .createHmac('sha256', process.env.CHAPA_WEBHOOK_SECRET!)
      .update(payload)
      .digest('hex');

    if (hash !== signature) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // 2. Log the webhook for audit
    await prisma.chapaWebhookLog.create({
      data: {
        eventType: body.event,
        chapaTxRef: body.tx_ref, // now guaranteed non-null
        chapaTxId: body.id,      // guaranteed non-null
        payload: body,
      },
    });

    // 3. Process the payment update
    if (body.event === 'charge.success') {
      const payment = await prisma.payment.findUnique({
        where: { chapaTxRef: body.tx_ref },
        include: { sale: true },
      });

      if (payment && payment.status === 'PENDING') {
        await prisma.$transaction([
          prisma.payment.update({
            where: { id: payment.id },
            data: { 
              status: 'COMPLETED', 
              paidAt: new Date(), 
              chapaTxId: body.id 
            },
          }),
          prisma.sale.update({
            where: { id: payment.saleId! },
            data: { status: 'COMPLETED' },
          }),
          // Add inventory update logic here if needed
        ]);
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Chapa webhook error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}