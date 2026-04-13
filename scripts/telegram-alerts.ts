import 'dotenv/config';
import { prisma } from '../app/lib/prisma';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID!;

async function sendTelegramMessage(message: string) {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: ADMIN_CHAT_ID, text: message, parse_mode: 'Markdown' }),
  });
  if (!response.ok) {
    console.error('Failed to send Telegram alert:', await response.text());
  }
}

async function checkLowStock() {
  const lowStockDrugs = await prisma.drug.findMany({
    where: { stock: { lte: prisma.drug.fields.minStockLevel }, isActive: true },
  });
  if (lowStockDrugs.length === 0) return;
  const msg = lowStockDrugs.map(d => `• ${d.name}: ${d.stock} (min ${d.minStockLevel})`).join('\n');
  await sendTelegramMessage(`⚠️ *Low Stock Alert*\n${msg}`);
}

async function checkExpiringBatches() {
  const thirtyDays = new Date();
  thirtyDays.setDate(thirtyDays.getDate() + 30);
  const expiring = await prisma.drugBatch.findMany({
    where: { expiryDate: { lte: thirtyDays }, remaining: { gt: 0 } },
    include: { drug: true },
    orderBy: { expiryDate: 'asc' },
  });
  if (expiring.length === 0) return;
  const msg = expiring.map(b =>
    `• ${b.drug.name} (${b.batchNumber}): expires ${new Date(b.expiryDate).toLocaleDateString()}, remaining: ${b.remaining}`
  ).join('\n');
  await sendTelegramMessage(`⚠️ *Expiring Soon (within 30 days)*\n${msg}`);
}

async function main() {
  console.log('Checking alerts...');
  await checkLowStock();
  await checkExpiringBatches();
  console.log('Alerts check completed.');
}

main().catch(console.error);