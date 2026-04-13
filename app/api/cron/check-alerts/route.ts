import { NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { sendTelegramToAdminGroup } from '@/app/service/telegram/service';

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Low stock alerts
  const lowStockDrugs = await prisma.drug.findMany({
    where: { stock: { lte: prisma.drug.fields.minStockLevel }, isActive: true },
  });
  if (lowStockDrugs.length) {
    const msg = lowStockDrugs.map(d => `• ${d.name}: ${d.stock} (min ${d.minStockLevel})`).join('\n');
    await sendTelegramToAdminGroup(`⚠️ *Low Stock Alert*\n${msg}`);
  }

  // Expiring batches (within 30 days)
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
  const expiring = await prisma.drugBatch.findMany({
    where: { expiryDate: { lte: thirtyDaysFromNow }, remaining: { gt: 0 } },
    include: { drug: true },
  });
  if (expiring.length) {
    const msg = expiring.map(b =>
      `• ${b.drug.name} (${b.batchNumber}): expires ${new Date(b.expiryDate).toLocaleDateString()}, remaining: ${b.remaining}`
    ).join('\n');
    await sendTelegramToAdminGroup(`⚠️ *Expiring Soon (within 30 days)*\n${msg}`);
  }

  return NextResponse.json({ success: true });
}