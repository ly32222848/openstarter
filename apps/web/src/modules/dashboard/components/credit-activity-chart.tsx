// 仪表盘积分动态图：近 30 天逐日授予 / 消耗双曲线（recharts + ChartContainer）。

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@openstarter/ui-web/components/chart";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@openstarter/ui-web/components/card";
import { Skeleton } from "@openstarter/ui-web/components/skeleton";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import { m } from "@/paraglide/messages.js";

import type { DashboardStats } from "./stats-view";

const chartConfig = {
  granted: { color: "var(--chart-2)", label: m["dashboard.chart.granted"]() },
  consumed: { color: "var(--chart-1)", label: m["dashboard.chart.consumed"]() },
} as const;

/** 轴刻度只显示 `MM-DD`，避免横轴拥挤。 */
function formatTick(date: string): string {
  return date.slice(5);
}

export function CreditActivityChart({
  isPending,
  stats,
}: {
  isPending: boolean;
  stats: DashboardStats | undefined;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{m["dashboard.chart.title"]()}</CardTitle>
        <CardDescription>{m["dashboard.chart.description"]()}</CardDescription>
      </CardHeader>
      <CardContent>
        {isPending || !stats ? (
          <Skeleton className="h-[240px] w-full" />
        ) : (
          <ChartContainer className="h-[240px] w-full" config={chartConfig}>
            <LineChart data={stats.trend} margin={{ bottom: 0, left: 0, right: 8, top: 8 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                axisLine={false}
                dataKey="date"
                tickFormatter={formatTick}
                tickLine={false}
                tickMargin={8}
              />
              <YAxis axisLine={false} tickLine={false} width={40} />
              <ChartTooltip content={<ChartTooltipContent indicator="line" />} />
              <Line
                dataKey="granted"
                dot={false}
                stroke="var(--color-granted)"
                strokeWidth={2}
                type="monotone"
              />
              <Line
                dataKey="consumed"
                dot={false}
                stroke="var(--color-consumed)"
                strokeWidth={2}
                type="monotone"
              />
            </LineChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
