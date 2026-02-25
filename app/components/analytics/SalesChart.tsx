"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/app/components/ui/Card";

interface SalesData {
  date: string;
  sales: number;
  transactions: number;
}

interface SalesChartProps {
  data: SalesData[];
  title?: string;
  description?: string;
}

export function SalesChart({ data, title = "Sales Trend", description = "Daily sales performance" }: SalesChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="date" className="text-xs" />
              <YAxis yAxisId="left" className="text-xs" tickFormatter={(value) => `$${value}`} />
              <YAxis yAxisId="right" orientation="right" className="text-xs" />
              <Tooltip />
              <Legend />
              <Line
                yAxisId="left"
                type="monotone"
                dataKey="sales"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                name="Sales"
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="transactions"
                stroke="hsl(var(--chart-2))"
                strokeWidth={2}
                name="Transactions"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
