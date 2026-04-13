import { Telegraf } from 'telegraf';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';


const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN!);

// Helper to get inventory summary
async function getInventorySummary() {
  const drugs = await prisma.drug.findMany({
    where: { isActive: true },
    select: { name: true, stock: true, minStockLevel: true, price: true },
  });
  const lowStock = drugs.filter(d => d.stock <= d.minStockLevel);
  const totalValue = drugs.reduce((sum, d) => sum + (d.stock * Number(d.price)), 0);
  return { totalItems: drugs.length, lowStockCount: lowStock.length, totalValue };
}

// Command: /start
bot.command('start', async (ctx) => {
  await ctx.reply(
    `🤖 *Pharmacy Inventory Bot*\n\nCommands:\n` +
    `/inventory - Show inventory summary\n` +
    `/stock <drug> - Check stock of a drug\n` +
    `/expiring - List batches expiring soon\n` +
    `/sales - Today's sales (admin only)`,
    { parse_mode: 'Markdown' }
  );
});

// Command: /inventory
bot.command('inventory', async (ctx) => {
  const { totalItems, lowStockCount, totalValue } = await getInventorySummary();
  const message = `📊 *Inventory Summary*\n\nTotal items: ${totalItems}\nLow stock items: ${lowStockCount}\nTotal value: $${totalValue.toFixed(2)}`;
  await ctx.reply(message, { parse_mode: 'Markdown' });
});

// Command: /stock <drug name>
bot.command('stock', async (ctx) => {
  const args = ctx.message.text.split(' ').slice(1);
  const drugName = args.join(' ');
  if (!drugName) return ctx.reply('Please provide a drug name. Example: `/stock Amoxicillin`', { parse_mode: 'Markdown' });
  const drug = await prisma.drug.findFirst({
    where: { name: { contains: drugName, mode: 'insensitive' }, isActive: true },
    include: { batches: { where: { remaining: { gt: 0 } }, orderBy: { expiryDate: 'asc' } } },
  });
  if (!drug) return ctx.reply(`❌ Drug "${drugName}" not found.`);
  let batchInfo = '';
  if (drug.batches.length) {
    batchInfo = '\n\n*Batches:*\n' + drug.batches.map(b =>
      `• ${b.batchNumber}: ${b.remaining} units (expires ${new Date(b.expiryDate).toLocaleDateString()})`
    ).join('\n');
  }
  const status = drug.stock === 0 ? '❌ Out of Stock' : (drug.stock <= drug.minStockLevel ? '⚠️ Low Stock' : '✅ In Stock');
  const message = `*${drug.name}*\n${status}\nStock: ${drug.stock}\nMin Level: ${drug.minStockLevel}\nPrice: $${Number(drug.price).toFixed(2)}${batchInfo}`;
  await ctx.reply(message, { parse_mode: 'Markdown' });
});

// Command: /expiring
bot.command('expiring', async (ctx) => {
  const thirtyDays = new Date();
  thirtyDays.setDate(thirtyDays.getDate() + 30);
  const expiring = await prisma.drugBatch.findMany({
    where: { expiryDate: { lte: thirtyDays }, remaining: { gt: 0 } },
    include: { drug: true },
    orderBy: { expiryDate: 'asc' },
    take: 15,
  });
  if (expiring.length === 0) return ctx.reply('✅ No batches expiring within 30 days.');
  const msg = expiring.map(b =>
    `• ${b.drug.name} (${b.batchNumber}): expires ${new Date(b.expiryDate).toLocaleDateString()}, remaining: ${b.remaining}`
  ).join('\n');
  await ctx.reply(`⚠️ *Expiring Soon (within 30 days)*\n${msg}`, { parse_mode: 'Markdown' });
});

// Command: /sales (today's sales)
bot.command('sales', async (ctx) => {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);
  const sales = await prisma.sale.findMany({
    where: { createdAt: { gte: todayStart, lte: todayEnd }, status: 'COMPLETED' },
    include: { saleItems: { include: { drug: true } } },
  });
  if (sales.length === 0) return ctx.reply('📅 No sales today.');
  let total = 0;
  const items = sales.flatMap(s => s.saleItems.map(i => ({ name: i.drug.name, qty: i.quantity })));
  const grouped = items.reduce((acc, i) => {
    acc[i.name] = (acc[i.name] || 0) + i.qty;
    return acc;
  }, {} as Record<string, number>);
  const summary = Object.entries(grouped).map(([name, qty]) => `• ${name}: ${qty}`).join('\n');
  total = sales.reduce((sum, s) => sum + Number(s.netAmount), 0);
  const message = `📈 *Today's Sales*\nTransactions: ${sales.length}\nTotal: $${total.toFixed(2)}\n\n*Top Items*\n${summary}`;
  await ctx.reply(message, { parse_mode: 'Markdown' });
});

// Webhook handler
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    await bot.handleUpdate(body);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}