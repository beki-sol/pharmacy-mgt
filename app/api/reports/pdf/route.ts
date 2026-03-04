import { NextRequest, NextResponse } from "next/server";
import puppeteer from "puppeteer";
import Handlebars from "handlebars";
import { prisma } from "@/app/lib/prisma";
import { startOfDay, endOfDay } from "date-fns";
import type { TemplateDelegate } from "handlebars";

// Helper to convert Decimal to number (same as in main reports API)
function toNumber(value: any): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "object" && value !== null && "toNumber" in value) {
    return value.toNumber();
  }
  return Number(value);
}

// ---------- Data fetching functions (same as main reports) ----------
async function getSalesReport(gte: Date, lte: Date) {
  const sales = await prisma.sale.findMany({
    where: {
      createdAt: { gte, lte },
      status: "COMPLETED",
    },
    select: {
      id: true,
      invoiceNumber: true,
      createdAt: true,
      customerName: true,
      netAmount: true,
      paymentMethod: true,
    },
    orderBy: { createdAt: "desc" },
  });

  let total = 0;
  for (const s of sales) {
    total += toNumber(s.netAmount);
  }
  const count = sales.length;

  return { total, count, sales };
}

async function getInventoryReport() {
  const drugs = await prisma.drug.findMany({
    where: { isActive: true },
    select: { price: true, stock: true, minStockLevel: true },
  });

  let totalValue = 0;
  let lowStockCount = 0;
  for (const d of drugs) {
    totalValue += toNumber(d.price) * d.stock;
    if (d.stock <= d.minStockLevel) lowStockCount++;
  }

  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
  const expiring = await prisma.drugBatch.findMany({
    where: {
      expiryDate: { lte: thirtyDaysFromNow },
      remaining: { gt: 0 },
    },
    include: { drug: { select: { name: true } } },
    orderBy: { expiryDate: "asc" },
    take: 100,
  });

  return { totalValue, lowStockCount, expiring };
}

async function getProfitReport(gte: Date, lte: Date) {
  const sales = await prisma.sale.findMany({
    where: {
      createdAt: { gte, lte },
      status: "COMPLETED",
    },
    include: {
      saleItems: {
        include: { drug: { select: { costPrice: true } } },
      },
    },
  });

  let revenue = 0;
  let cost = 0;
  for (const sale of sales) {
    revenue += toNumber(sale.netAmount);
    for (const item of sale.saleItems) {
      cost += item.quantity * toNumber(item.drug.costPrice);
    }
  }

  const profit = revenue - cost;
  const margin = revenue ? (profit / revenue) * 100 : 0;

  return { revenue, cost, profit, margin };
}

// ---------- PDF Generation ----------
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "sales";
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    if (!startDate || !endDate) {
      return NextResponse.json({ error: "startDate and endDate required" }, { status: 400 });
    }

    const gte = new Date(startDate);
    const lte = endOfDay(new Date(endDate));

    // Fetch data based on report type
    let data;
    switch (type) {
      case "sales":
        data = await getSalesReport(gte, lte);
        break;
      case "inventory":
        data = await getInventoryReport();
        break;
      case "profit":
        data = await getProfitReport(gte, lte);
        break;
      default:
        return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }

    // Prepare HTML template with Chart.js
    const templateSource = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>{{type}} Report</title>
      <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
      <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        h1 { color: #333; }
        .summary { display: flex; gap: 20px; margin: 20px 0; flex-wrap: wrap; }
        .card { border: 1px solid #ddd; padding: 20px; border-radius: 8px; flex: 1; min-width: 200px; }
        .card h3 { margin: 0 0 10px; color: #666; }
        .card .value { font-size: 24px; font-weight: bold; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f4f4f4; }
        canvas { max-height: 300px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <h1>{{type}} Report ({{startDate}} to {{endDate}})</h1>
      
      <div class="summary">
        {{#each summary}}
        <div class="card">
          <h3>{{this.label}}</h3>
          <div class="value">{{this.value}}</div>
        </div>
        {{/each}}
      </div>

      <canvas id="chart"></canvas>

      <h2>Details</h2>
      <table>
        <thead>
          <tr>
            {{#each headers}}
            <th>{{this}}</th>
            {{/each}}
          </tr>
        </thead>
        <tbody>
          {{#each rows}}
          <tr>
            {{#each this}}
            <td>{{this}}</td>
            {{/each}}
          </tr>
          {{/each}}
        </tbody>
      </table>

      <script>
        const ctx = document.getElementById('chart').getContext('2d');
        new Chart(ctx, {{{chartConfig}}});
      </script>
    </body>
    </html>
    `;

    const template = Handlebars.compile(templateSource);
    const html = buildTemplateData(type, data, startDate, endDate, template);

    // Launch Puppeteer and generate PDF
    const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] }); // for server environments
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    const pdf = await page.pdf({ format: "A4", printBackground: true });
    // Convert to Buffer (important fix)
   const pdfBuffer = Buffer.from(pdf);
    await browser.close();
    



    // Return PDF as downloadable file
    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${type}-report.pdf"`,
      },
    });
  } catch (error) {
    console.error("PDF generation error:", error);
    return NextResponse.json({ error: "PDF generation failed" }, { status: 500 });
  }
}

// Helper to build template data
function buildTemplateData(
  type: string,
  data: any,
  startDate: string,
  endDate: string,
  template: TemplateDelegate
   ) {
  const common = {
    type: type.toUpperCase(),
    startDate: new Date(startDate).toLocaleDateString(),
    endDate: new Date(endDate).toLocaleDateString(),
  };

  if (type === "sales") {
    const salesData = data.sales.slice(0, 20); // limit for PDF
    return template({
      ...common,
      summary: [
        { label: "Total Sales", value: `$${data.total.toFixed(2)}` },
        { label: "Transactions", value: data.count },
        { label: "Average Ticket", value: `$${(data.total / data.count).toFixed(2)}` },
      ],
      headers: ["Invoice", "Date", "Customer", "Amount", "Payment Method"],
      rows: salesData.map((s: any) => [
        s.invoiceNumber,
        new Date(s.createdAt).toLocaleDateString(),
        s.customerName || "Guest",
        `$${s.netAmount.toFixed(2)}`,
        s.paymentMethod,
      ]),
      chartConfig: JSON.stringify({
        type: "line",
        data: {
          labels: salesData.map((s: any) => new Date(s.createdAt).toLocaleDateString()),
          datasets: [{
            label: "Sales Amount",
            data: salesData.map((s: any) => s.netAmount),
            borderColor: "rgb(75, 192, 192)",
            tension: 0.1,
          }]
        },
        options: { responsive: true }
      }),
    });
  }

  if (type === "inventory") {
    return template({
      ...common,
      summary: [
        { label: "Total Value", value: `$${data.totalValue.toFixed(2)}` },
        { label: "Low Stock Items", value: data.lowStockCount },
      ],
      headers: ["Drug", "Batch", "Expiry", "Remaining"],
      rows: data.expiring.map((e: any) => [
        e.drug.name,
        e.batchNumber,
        new Date(e.expiryDate).toLocaleDateString(),
        e.remaining,
      ]),
      chartConfig: JSON.stringify({
        type: "bar",
        data: {
          labels: ["Low Stock", "Normal Stock"],
          datasets: [{
            label: "Items",
            data: [data.lowStockCount, data.expiring.length - data.lowStockCount],
            backgroundColor: ["#ff8042", "#0088fe"],
          }]
        }
      }),
    });
  }

  if (type === "profit") {
    return template({
      ...common,
      summary: [
        { label: "Revenue", value: `$${data.revenue.toFixed(2)}` },
        { label: "Cost", value: `$${data.cost.toFixed(2)}` },
        { label: "Profit", value: `$${data.profit.toFixed(2)}` },
        { label: "Margin", value: `${data.margin.toFixed(1)}%` },
      ],
      headers: [],
      rows: [],
      chartConfig: JSON.stringify({
        type: "doughnut",
        data: {
          labels: ["Profit", "Cost"],
          datasets: [{
            data: [data.profit, data.cost],
            backgroundColor: ["#00c49f", "#ff8042"],
          }]
        }
      }),
    });
  }

  return "";
}