import { Telegraf, Context } from 'telegraf';
import 'dotenv/config';
import { prisma } from '../app/lib/prisma';

// ---------- Types ----------
type SalesFilter = {
  customer: string | null;
  fromDate: string | null;
  toDate: string | null;
  paymentMethod: string | null;
  drugId: string | null;
};

type InventoryLogFilter = {
  fromDate: string | null;
  toDate: string | null;
  type: string | null;
  drugId: string | null;
};

type UserState = {
  waitingFor: string | null;
  salesFilter: SalesFilter;
  inventoryLogFilter: InventoryLogFilter;
  lastSalesResults: any[] | null;
  lastSalesPage: number;
  lastInventoryResults: any[] | null;
  lastInventoryPage: number;
};

// ---------- Bot setup ----------
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN!);
const userStates = new Map<number, UserState>();

function getUserState(chatId: number): UserState {
  if (!userStates.has(chatId)) {
    userStates.set(chatId, {
      waitingFor: null,
      salesFilter: { customer: null, fromDate: null, toDate: null, paymentMethod: null, drugId: null },
      inventoryLogFilter: { fromDate: null, toDate: null, type: null, drugId: null },
      lastSalesResults: null,
      lastSalesPage: 0,
      lastInventoryResults: null,
      lastInventoryPage: 0,
    });
  }
  return userStates.get(chatId)!;
}

// ---------- Database helpers ----------
async function getInventorySummary() {
  const drugs = await prisma.drug.findMany({
    where: { isActive: true },
    select: { name: true, stock: true, minStockLevel: true, price: true },
  });
  const lowStock = drugs.filter(d => d.stock <= d.minStockLevel);
  const totalValue = drugs.reduce((sum, d) => sum + (d.stock * Number(d.price)), 0);
  return { totalItems: drugs.length, lowStockCount: lowStock.length, totalValue };
}

async function getExpiringBatches() {
  const thirtyDays = new Date();
  thirtyDays.setDate(thirtyDays.getDate() + 30);
  return await prisma.drugBatch.findMany({
    where: { expiryDate: { lte: thirtyDays }, remaining: { gt: 0 } },
    include: { drug: true },
    orderBy: { expiryDate: 'asc' },
    take: 15,
  });
}

async function getTodaysSales() {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);
  return await prisma.sale.findMany({
    where: { createdAt: { gte: todayStart, lte: todayEnd }, status: 'COMPLETED' },
    include: { saleItems: { include: { drug: true } } },
  });
}

async function getFilteredSales(filter: SalesFilter) {
  const where: any = { status: 'COMPLETED' };
  if (filter.customer) {
    where.customerName = { contains: filter.customer, mode: 'insensitive' };
  }
  if (filter.fromDate && filter.toDate) {
    where.createdAt = {
      gte: new Date(filter.fromDate),
      lte: new Date(filter.toDate + 'T23:59:59.999Z'),
    };
  }
  if (filter.paymentMethod) {
    where.paymentMethod = filter.paymentMethod;
  }
  let sales = await prisma.sale.findMany({
    where,
    include: { saleItems: { include: { drug: true } } },
    orderBy: { createdAt: 'desc' },
  });
  if (filter.drugId) {
    sales = sales.filter(sale =>
      sale.saleItems.some(item => item.drugId === filter.drugId)
    );
  }
  return sales;
}

async function getFilteredInventoryLogs(filter: InventoryLogFilter) {
  const where: any = {};
  if (filter.fromDate && filter.toDate) {
    where.createdAt = {
      gte: new Date(filter.fromDate),
      lte: new Date(filter.toDate + 'T23:59:59.999Z'),
    };
  }
  if (filter.type && filter.type !== 'ALL') {
    where.type = filter.type;
  }
  if (filter.drugId) {
    where.drugId = filter.drugId;
  }
  return await prisma.inventoryLog.findMany({
    where,
    include: { drug: true, user: true },
    orderBy: { createdAt: 'desc' },
  });
}

// ---------- Formatting helpers with pagination ----------
function formatSaleList(sales: any[], page: number, itemsPerPage: number = 5): { text: string; totalPages: number } {
  const totalPages = Math.ceil(sales.length / itemsPerPage);
  const start = page * itemsPerPage;
  const end = start + itemsPerPage;
  const pageSales = sales.slice(start, end);
  if (pageSales.length === 0) return { text: 'No sales match the filters.', totalPages: 0 };
  let msg = `*Sales Results (Page ${page + 1} of ${totalPages})*\n\n`;
  for (const sale of pageSales) {
    const items = sale.saleItems.map((i: any) => `${i.quantity}x ${i.drug.name}`).join(', ');
    msg += `🧾 *${sale.invoiceNumber}* – ${new Date(sale.createdAt).toLocaleDateString()}\n`;
    msg += `   Customer: ${sale.customerName || 'Guest'}\n`;
    msg += `   Payment: ${sale.paymentMethod}\n`;
    msg += `   Items: ${items}\n`;
    msg += `   Total: $${Number(sale.netAmount).toFixed(2)}\n\n`;
  }
  return { text: msg, totalPages };
}

function formatInventoryLogList(logs: any[], page: number, itemsPerPage: number = 5): { text: string; totalPages: number } {
  const totalPages = Math.ceil(logs.length / itemsPerPage);
  const start = page * itemsPerPage;
  const end = start + itemsPerPage;
  const pageLogs = logs.slice(start, end);
  if (pageLogs.length === 0) return { text: 'No inventory logs match the filters.', totalPages: 0 };
  let msg = `*Inventory Logs (Page ${page + 1} of ${totalPages})*\n\n`;
  for (const log of pageLogs) {
    const quantityStr = log.quantity > 0 ? `+${log.quantity}` : `${log.quantity}`;
    msg += `📅 ${new Date(log.createdAt).toLocaleDateString()} ${new Date(log.createdAt).toLocaleTimeString()}\n`;
    msg += `   Drug: ${log.drug.name}\n`;
    msg += `   Type: ${log.type}\n`;
    msg += `   Quantity: ${quantityStr}\n`;
    msg += `   Stock: ${log.previousStock} → ${log.newStock}\n`;
    if (log.notes) msg += `   Notes: ${log.notes}\n`;
    msg += `   User: ${log.user?.name || 'System'}\n\n`;
  }
  return { text: msg, totalPages };
}

// ---------- Drug list pagination helpers ----------
let allDrugs: { id: string; name: string }[] = [];
async function loadDrugs() {
  if (allDrugs.length === 0) {
    allDrugs = await prisma.drug.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
  }
  return allDrugs;
}

async function getDrugKeyboard(page: number = 0, itemsPerPage: number = 10) {
  const drugs = await loadDrugs();
  const start = page * itemsPerPage;
  const end = start + itemsPerPage;
  const pageDrugs = drugs.slice(start, end);
  const keyboard: any = {
    inline_keyboard: pageDrugs.map(drug => [{ text: drug.name, callback_data: `select_drug_${drug.id}` }]),
  };
  if (start > 0 || end < drugs.length) {
    const navButtons = [];
    if (start > 0) navButtons.push({ text: '◀️ Previous', callback_data: `drug_page_${page - 1}` });
    if (end < drugs.length) navButtons.push({ text: 'Next ▶️', callback_data: `drug_page_${page + 1}` });
    if (navButtons.length) keyboard.inline_keyboard.push(navButtons);
  }
  keyboard.inline_keyboard.push([{ text: '❌ Cancel', callback_data: 'cancel_filter' }]);
  return keyboard;
}

// ---------- Basic commands ----------
bot.start(async (ctx) => {
  await ctx.reply(
    `🤖 *Pharmacy Inventory Bot*\n\n` +
    `Commands:\n` +
    `/inventory – Show inventory summary\n` +
    `/stock <drug> – Check stock of a drug\n` +
    `/expiring – List batches expiring within 30 days\n` +
    `/sales – Today's sales\n` +
    `/sales_filter – Advanced sales filter (customer, date, payment, drug)\n` +
    `/inventory_filter – Advanced inventory logs filter (date, type, drug)\n` +
    `/help – Show this message`,
    { parse_mode: 'Markdown' }
  );
});

bot.command('help', async (ctx) => {
  await ctx.reply(
    `🤖 *Pharmacy Inventory Bot*\n\n` +
    `/inventory – Show inventory summary\n` +
    `/stock <drug> – Check stock of a drug\n` +
    `/expiring – List batches expiring within 30 days\n` +
    `/sales – Today's sales\n` +
    `/sales_filter – Filter sales by customer, date range, payment method, or drug name\n` +
    `/inventory_filter – Filter inventory logs by date range, log type, or drug name\n` +
    `/help – This message`,
    { parse_mode: 'Markdown' }
  );
});

bot.command('inventory', async (ctx) => {
  const { totalItems, lowStockCount, totalValue } = await getInventorySummary();
  const message = `📊 *Inventory Summary*\n\nTotal items: ${totalItems}\nLow stock items: ${lowStockCount}\nTotal value: $${totalValue.toFixed(2)}`;
  await ctx.reply(message, { parse_mode: 'Markdown' });
});

bot.command('stock', async (ctx) => {
  const args = ctx.message.text.split(' ').slice(1);
  const drugName = args.join(' ');
  if (!drugName) {
    return ctx.reply('Please provide a drug name. Example: `/stock Amoxicillin`', { parse_mode: 'Markdown' });
  }
  const drug = await prisma.drug.findFirst({
    where: { name: { contains: drugName, mode: 'insensitive' }, isActive: true },
    include: { batches: { where: { remaining: { gt: 0 } }, orderBy: { expiryDate: 'asc' } } },
  });
  if (!drug) return ctx.reply(`❌ Drug "${drugName}" not found.`);
  let batchInfo = '';
  if (drug.batches.length) {
    batchInfo = '\n\n*Batches:*\n' + drug.batches.map((b: any) =>
      `• ${b.batchNumber}: ${b.remaining} units (expires ${new Date(b.expiryDate).toLocaleDateString()})`
    ).join('\n');
  }
  const status = drug.stock === 0 ? '❌ Out of Stock' : (drug.stock <= drug.minStockLevel ? '⚠️ Low Stock' : '✅ In Stock');
  const message = `*${drug.name}*\n${status}\nStock: ${drug.stock}\nMin Level: ${drug.minStockLevel}\nPrice: $${Number(drug.price).toFixed(2)}${batchInfo}`;
  await ctx.reply(message, { parse_mode: 'Markdown' });
});

bot.command('expiring', async (ctx) => {
  const expiring = await getExpiringBatches();
  if (expiring.length === 0) return ctx.reply('✅ No batches expiring within 30 days.');
  const msg = expiring.map((b: any) =>
    `• ${b.drug.name} (${b.batchNumber}): expires ${new Date(b.expiryDate).toLocaleDateString()}, remaining: ${b.remaining}`
  ).join('\n');
  await ctx.reply(`⚠️ *Expiring Soon (within 30 days)*\n${msg}`, { parse_mode: 'Markdown' });
});

bot.command('sales', async (ctx) => {
  const sales = await getTodaysSales();
  if (sales.length === 0) return ctx.reply('📅 No sales today.');
  let total = 0;
  const items = sales.flatMap(s => s.saleItems.map((i: any) => ({ name: i.drug.name, qty: i.quantity })));
  const grouped = items.reduce((acc: Record<string, number>, i) => {
    acc[i.name] = (acc[i.name] || 0) + i.qty;
    return acc;
  }, {});
  const summary = Object.entries(grouped).map(([name, qty]) => `• ${name}: ${qty}`).join('\n');
  total = sales.reduce((sum, s) => sum + Number(s.netAmount), 0);
  const message = `📈 *Today's Sales*\nTransactions: ${sales.length}\nTotal: $${total.toFixed(2)}\n\n*Top Items*\n${summary}`;
  await ctx.reply(message, { parse_mode: 'Markdown' });
});

// ---------- Advanced Sales Filter ----------
bot.command('sales_filter', async (ctx) => {
  const chatId = ctx.chat?.id;
  if (!chatId) return;
  const state = getUserState(chatId);
  state.salesFilter = { customer: null, fromDate: null, toDate: null, paymentMethod: null, drugId: null };
  const keyboard = {
    inline_keyboard: [
      [{ text: '👤 Filter by customer', callback_data: 'sales_filter_customer' }],
      [{ text: '📅 Filter by date range', callback_data: 'sales_filter_date' }],
      [{ text: '💳 Filter by payment method', callback_data: 'sales_filter_payment' }],
      [{ text: '💊 Filter by drug name', callback_data: 'sales_filter_drug_list' }],
      [{ text: '❌ Clear all filters', callback_data: 'sales_filter_clear' }],
      [{ text: '📋 Show results', callback_data: 'sales_filter_show' }],
    ],
  };
  await ctx.reply('📊 *Sales Filter* – choose an option:', {
    parse_mode: 'Markdown',
    reply_markup: keyboard,
  });
});

bot.action(/sales_filter_(\w+)/, async (ctx) => {
  const chatId = ctx.chat?.id;
  if (!chatId) return;
  const state = getUserState(chatId);
  const action = ctx.match[1];
  if (action === 'customer') {
    await ctx.editMessageText('✏️ Send the customer name (or part of it):');
    state.waitingFor = 'sales_customer';
  } else if (action === 'date') {
    await ctx.editMessageText('📅 Send start and end date (YYYY-MM-DD) separated by space.\nExample: `2025-04-01 2025-04-13`', { parse_mode: 'Markdown' });
    state.waitingFor = 'sales_date';
  } else if (action === 'payment') {
    const keyboard = {
      inline_keyboard: [
        [{ text: 'Cash', callback_data: 'sales_payment_CASH' }],
        [{ text: 'Card', callback_data: 'sales_payment_CARD' }],
        [{ text: 'Chapa', callback_data: 'sales_payment_CHAPA' }],
        [{ text: 'Insurance', callback_data: 'sales_payment_INSURANCE' }],
        [{ text: 'Mixed', callback_data: 'sales_payment_MIXED' }],
      ],
    };
    await ctx.editMessageText('Select payment method:', { reply_markup: keyboard });
  } else if (action === 'drug_list') {
    const keyboard = await getDrugKeyboard(0);
    await ctx.editMessageText('Select a drug to filter sales:', { reply_markup: keyboard });
    state.waitingFor = 'sales_drug';
  } else if (action === 'clear') {
    state.salesFilter = { customer: null, fromDate: null, toDate: null, paymentMethod: null, drugId: null };
    state.lastSalesResults = null;
    state.lastSalesPage = 0;
    await ctx.editMessageText('✅ Filters cleared. Use /sales_filter again.');
  } else if (action === 'show') {
    const sales = await getFilteredSales(state.salesFilter);
    state.lastSalesResults = sales;
    state.lastSalesPage = 0;
    const { text, totalPages } = formatSaleList(sales, 0);
    const keyboard = totalPages > 1 ? {
      inline_keyboard: [
        [{ text: '▶️ Next', callback_data: 'sales_next_page' }]
      ]
    } : undefined;
    await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: keyboard });
  }
  await ctx.answerCbQuery();
});

// Sales pagination navigation
bot.action('sales_next_page', async (ctx) => {
  const chatId = ctx.chat?.id;
  if (!chatId) return;
  const state = getUserState(chatId);
  if (!state.lastSalesResults) return;
  const newPage = state.lastSalesPage + 1;
  const { text, totalPages } = formatSaleList(state.lastSalesResults, newPage);
  if (newPage >= totalPages) {
    await ctx.editMessageText(text, { parse_mode: 'Markdown' });
    state.lastSalesPage = newPage;
  } else {
    const keyboard = {
      inline_keyboard: [
        [{ text: '◀️ Previous', callback_data: 'sales_prev_page' }, { text: '▶️ Next', callback_data: 'sales_next_page' }]
      ]
    };
    await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: keyboard });
    state.lastSalesPage = newPage;
  }
  await ctx.answerCbQuery();
});

bot.action('sales_prev_page', async (ctx) => {
  const chatId = ctx.chat?.id;
  if (!chatId) return;
  const state = getUserState(chatId);
  if (!state.lastSalesResults) return;
  const newPage = state.lastSalesPage - 1;
  if (newPage < 0) return;
  const { text, totalPages } = formatSaleList(state.lastSalesResults, newPage);
  const keyboard = newPage === 0
    ? (totalPages > 1 ? { inline_keyboard: [[{ text: '▶️ Next', callback_data: 'sales_next_page' }]] } : undefined)
    : { inline_keyboard: [[{ text: '◀️ Previous', callback_data: 'sales_prev_page' }, { text: '▶️ Next', callback_data: 'sales_next_page' }]] };
  await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: keyboard });
  state.lastSalesPage = newPage;
  await ctx.answerCbQuery();
});

bot.action(/drug_page_(\d+)/, async (ctx) => {
  const page = parseInt(ctx.match[1]);
  const keyboard = await getDrugKeyboard(page);
  await ctx.editMessageReplyMarkup(keyboard);
  await ctx.answerCbQuery();
});

bot.action(/select_drug_(.+)/, async (ctx) => {
  const chatId = ctx.chat?.id;
  if (!chatId) return;
  const state = getUserState(chatId);
  const drugId = ctx.match[1];
  if (state.waitingFor === 'sales_drug') {
    state.salesFilter.drugId = drugId;
    state.waitingFor = null;
    const sales = await getFilteredSales(state.salesFilter);
    state.lastSalesResults = sales;
    state.lastSalesPage = 0;
    const { text, totalPages } = formatSaleList(sales, 0);
    const keyboard = totalPages > 1 ? {
      inline_keyboard: [[{ text: '▶️ Next', callback_data: 'sales_next_page' }]]
    } : undefined;
    await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: keyboard });
  } else if (state.waitingFor === 'inventory_drug') {
    state.inventoryLogFilter.drugId = drugId;
    state.waitingFor = null;
    const logs = await getFilteredInventoryLogs(state.inventoryLogFilter);
    state.lastInventoryResults = logs;
    state.lastInventoryPage = 0;
    const { text, totalPages } = formatInventoryLogList(logs, 0);
    const keyboard = totalPages > 1 ? {
      inline_keyboard: [[{ text: '▶️ Next', callback_data: 'inventory_next_page' }]]
    } : undefined;
    await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: keyboard });
  }
  await ctx.answerCbQuery();
});

bot.action(/sales_payment_(\w+)/, async (ctx) => {
  const chatId = ctx.chat?.id;
  if (!chatId) return;
  const state = getUserState(chatId);
  const method = ctx.match[1];
  state.salesFilter.paymentMethod = method;
  state.waitingFor = null;
  const sales = await getFilteredSales(state.salesFilter);
  state.lastSalesResults = sales;
  state.lastSalesPage = 0;
  const { text, totalPages } = formatSaleList(sales, 0);
  const keyboard = totalPages > 1 ? {
    inline_keyboard: [[{ text: '▶️ Next', callback_data: 'sales_next_page' }]]
  } : undefined;
  await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: keyboard });
  await ctx.answerCbQuery();
});

bot.action('cancel_filter', async (ctx) => {
  const chatId = ctx.chat?.id;
  if (!chatId) return;
  const state = getUserState(chatId);
  state.waitingFor = null;
  await ctx.editMessageText('Filter cancelled.');
  await ctx.answerCbQuery();
});

// ---------- Advanced Inventory Logs Filter ----------
bot.command('inventory_filter', async (ctx) => {
  const chatId = ctx.chat?.id;
  if (!chatId) return;
  const state = getUserState(chatId);
  state.inventoryLogFilter = { fromDate: null, toDate: null, type: null, drugId: null };
  const keyboard = {
    inline_keyboard: [
      [{ text: '📅 Filter by date range', callback_data: 'inventory_filter_date' }],
      [{ text: '🏷️ Filter by log type', callback_data: 'inventory_filter_type' }],
      [{ text: '💊 Filter by drug name', callback_data: 'inventory_filter_drug_list' }],
      [{ text: '❌ Clear all filters', callback_data: 'inventory_filter_clear' }],
      [{ text: '📋 Show results', callback_data: 'inventory_filter_show' }],
    ],
  };
  await ctx.reply('📦 *Inventory Logs Filter* – choose an option:', {
    parse_mode: 'Markdown',
    reply_markup: keyboard,
  });
});

bot.action(/inventory_filter_(\w+)/, async (ctx) => {
  const chatId = ctx.chat?.id;
  if (!chatId) return;
  const state = getUserState(chatId);
  const action = ctx.match[1];
  if (action === 'date') {
    await ctx.editMessageText('📅 Send start and end date (YYYY-MM-DD) separated by space.\nExample: `2025-04-01 2025-04-13`', { parse_mode: 'Markdown' });
    state.waitingFor = 'inventory_date';
  } else if (action === 'type') {
    const keyboard = {
      inline_keyboard: [
        [{ text: 'PURCHASE', callback_data: 'inventory_type_PURCHASE' }],
        [{ text: 'SALE', callback_data: 'inventory_type_SALE' }],
        [{ text: 'ADJUSTMENT', callback_data: 'inventory_type_ADJUSTMENT' }],
        [{ text: 'RETURN', callback_data: 'inventory_type_RETURN' }],
        [{ text: 'DAMAGE', callback_data: 'inventory_type_DAMAGE' }],
        [{ text: 'EXPIRED', callback_data: 'inventory_type_EXPIRED' }],
      ],
    };
    await ctx.editMessageText('Select log type:', { reply_markup: keyboard });
  } else if (action === 'drug_list') {
    const keyboard = await getDrugKeyboard(0);
    await ctx.editMessageText('Select a drug to filter inventory logs:', { reply_markup: keyboard });
    state.waitingFor = 'inventory_drug';
  } else if (action === 'clear') {
    state.inventoryLogFilter = { fromDate: null, toDate: null, type: null, drugId: null };
    state.lastInventoryResults = null;
    state.lastInventoryPage = 0;
    await ctx.editMessageText('✅ Filters cleared. Use /inventory_filter again.');
  } else if (action === 'show') {
    const logs = await getFilteredInventoryLogs(state.inventoryLogFilter);
    state.lastInventoryResults = logs;
    state.lastInventoryPage = 0;
    const { text, totalPages } = formatInventoryLogList(logs, 0);
    const keyboard = totalPages > 1 ? {
      inline_keyboard: [[{ text: '▶️ Next', callback_data: 'inventory_next_page' }]]
    } : undefined;
    await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: keyboard });
  }
  await ctx.answerCbQuery();
});

// Inventory pagination navigation
bot.action('inventory_next_page', async (ctx) => {
  const chatId = ctx.chat?.id;
  if (!chatId) return;
  const state = getUserState(chatId);
  if (!state.lastInventoryResults) return;
  const newPage = state.lastInventoryPage + 1;
  const { text, totalPages } = formatInventoryLogList(state.lastInventoryResults, newPage);
  if (newPage >= totalPages) {
    await ctx.editMessageText(text, { parse_mode: 'Markdown' });
    state.lastInventoryPage = newPage;
  } else {
    const keyboard = {
      inline_keyboard: [
        [{ text: '◀️ Previous', callback_data: 'inventory_prev_page' }, { text: '▶️ Next', callback_data: 'inventory_next_page' }]
      ]
    };
    await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: keyboard });
    state.lastInventoryPage = newPage;
  }
  await ctx.answerCbQuery();
});

bot.action('inventory_prev_page', async (ctx) => {
  const chatId = ctx.chat?.id;
  if (!chatId) return;
  const state = getUserState(chatId);
  if (!state.lastInventoryResults) return;
  const newPage = state.lastInventoryPage - 1;
  if (newPage < 0) return;
  const { text, totalPages } = formatInventoryLogList(state.lastInventoryResults, newPage);
  const keyboard = newPage === 0
    ? (totalPages > 1 ? { inline_keyboard: [[{ text: '▶️ Next', callback_data: 'inventory_next_page' }]] } : undefined)
    : { inline_keyboard: [[{ text: '◀️ Previous', callback_data: 'inventory_prev_page' }, { text: '▶️ Next', callback_data: 'inventory_next_page' }]] };
  await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: keyboard });
  state.lastInventoryPage = newPage;
  await ctx.answerCbQuery();
});

bot.action(/inventory_type_(\w+)/, async (ctx) => {
  const chatId = ctx.chat?.id;
  if (!chatId) return;
  const state = getUserState(chatId);
  const type = ctx.match[1];
  state.inventoryLogFilter.type = type;
  state.waitingFor = null;
  const logs = await getFilteredInventoryLogs(state.inventoryLogFilter);
  state.lastInventoryResults = logs;
  state.lastInventoryPage = 0;
  const { text, totalPages } = formatInventoryLogList(logs, 0);
  const keyboard = totalPages > 1 ? {
    inline_keyboard: [[{ text: '▶️ Next', callback_data: 'inventory_next_page' }]]
  } : undefined;
  await ctx.editMessageText(text, { parse_mode: 'Markdown', reply_markup: keyboard });
  await ctx.answerCbQuery();
});

// ---------- Handle text input for filters (only date range and customer) ----------
bot.on('text', async (ctx) => {
  const chatId = ctx.chat?.id;
  if (!chatId) return;
  const state = getUserState(chatId);
  if (!state.waitingFor) return;
  const input = ctx.message.text.trim();
  if (state.waitingFor === 'sales_customer') {
    state.salesFilter.customer = input;
    state.waitingFor = null;
    const sales = await getFilteredSales(state.salesFilter);
    state.lastSalesResults = sales;
    state.lastSalesPage = 0;
    const { text, totalPages } = formatSaleList(sales, 0);
    const keyboard = totalPages > 1 ? {
      inline_keyboard: [[{ text: '▶️ Next', callback_data: 'sales_next_page' }]]
    } : undefined;
    await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
  } else if (state.waitingFor === 'sales_date') {
    const parts = input.split(' ');
    if (parts.length === 2) {
      state.salesFilter.fromDate = parts[0];
      state.salesFilter.toDate = parts[1];
      const sales = await getFilteredSales(state.salesFilter);
      state.lastSalesResults = sales;
      state.lastSalesPage = 0;
      const { text, totalPages } = formatSaleList(sales, 0);
      const keyboard = totalPages > 1 ? {
        inline_keyboard: [[{ text: '▶️ Next', callback_data: 'sales_next_page' }]]
      } : undefined;
      await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
    } else {
      await ctx.reply('❌ Invalid format. Send two dates: YYYY-MM-DD YYYY-MM-DD');
    }
    state.waitingFor = null;
  } else if (state.waitingFor === 'inventory_date') {
    const parts = input.split(' ');
    if (parts.length === 2) {
      state.inventoryLogFilter.fromDate = parts[0];
      state.inventoryLogFilter.toDate = parts[1];
      const logs = await getFilteredInventoryLogs(state.inventoryLogFilter);
      state.lastInventoryResults = logs;
      state.lastInventoryPage = 0;
      const { text, totalPages } = formatInventoryLogList(logs, 0);
      const keyboard = totalPages > 1 ? {
        inline_keyboard: [[{ text: '▶️ Next', callback_data: 'inventory_next_page' }]]
      } : undefined;
      await ctx.reply(text, { parse_mode: 'Markdown', reply_markup: keyboard });
    } else {
      await ctx.reply('❌ Invalid format. Send two dates: YYYY-MM-DD YYYY-MM-DD');
    }
    state.waitingFor = null;
  }
});

// ---------- Launch bot ----------
bot.launch()
  .then(() => console.log('✅ Telegram bot is running (polling mode)...'))
  .catch(err => console.error('❌ Bot failed to start:', err));

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));