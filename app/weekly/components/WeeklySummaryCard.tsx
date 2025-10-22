import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { WeeklyStats } from "@/lib/weekly/aggregate";
import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import type { TooltipProps } from "recharts";
import { useMemo, useCallback } from "react";

type WeeklySummaryCardProps = {
  stats: WeeklyStats;
  confirmed: boolean;
  onConfirmChange: (value: boolean) => void;
};

type SparklinePoint = {
  dateISO: string;
  pain: number | undefined;
  label: string;
  missing: boolean;
  displayValue: string;
};

function formatPain(value: number | null): string {
  if (value === null || Number.isNaN(value)) {
    return "–";
  }
  return value % 1 === 0 ? value.toString() : value.toFixed(1);
}

const TICKS = [0, 2, 4, 6, 8, 10];

export function WeeklySummaryCard({ stats, confirmed, onConfirmChange }: WeeklySummaryCardProps): JSX.Element {
  const sparklineData = useMemo<SparklinePoint[]>(() => {
    return stats.sparkline.map((point) => {
      const date = new Date(`${point.dateISO}T00:00:00Z`);
      const label = date.toLocaleDateString("de-DE", { weekday: "short" });
      const missing = point.pain === null || Number.isNaN(point.pain ?? NaN);
      const pain = missing ? undefined : point.pain ?? undefined;
      return {
        dateISO: point.dateISO,
        label,
        pain,
        missing,
        displayValue: formatPain(point.pain),
      };
    });
  }, [stats.sparkline]);

  const tooltipFormatter = useCallback<
    TooltipProps<string | number, string>["formatter"]
  >((value, _name, entry) => {
    if (!entry) {
      return value ?? "";
    }

    const payload = entry.payload as SparklinePoint | undefined;
    if (!payload) {
      return value ?? "";
    }

    if (payload.missing) {
      return "Keine Angabe";
    }

    return payload.displayValue;
  }, []);

  const avgPain = formatPain(stats.avgPain);
  const maxPain = formatPain(stats.maxPain);
  const badDays = stats.badDaysCount;
  const bleedingDays = stats.bleedingDaysCount;

  const summaryId = "weekly-summary-confirmed";

  return (
    <Card className="border-rose-100 bg-rose-50/50">
      <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-rose-500">Woche auf einen Blick</p>
          <CardTitle className="text-2xl text-rose-900">Zusammenfassung</CardTitle>
          <p className="text-sm text-rose-900/70">
            Überblick über Schmerzwerte, Belastungstage und Blutungsintensität dieser Woche.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Label htmlFor={summaryId} className="text-sm text-rose-900">
            Zusammenfassung bestätigt
          </Label>
          <Switch id={summaryId} checked={confirmed} onCheckedChange={onConfirmChange} />
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryTile label="Ø Schmerz" value={avgPain} />
          <SummaryTile label="Max Schmerz" value={maxPain} />
          <SummaryTile label="Tage ≥ 6" value={badDays.toString()} />
          <SummaryTile label="Blutungstage" value={bleedingDays.toString()} />
        </div>
        <div className="h-40 w-full">
          <ResponsiveContainer>
            <LineChart data={sparklineData} margin={{ top: 10, right: 16, bottom: 4, left: 0 }}>
              <CartesianGrid stroke="rgba(244, 219, 227, 0.8)" strokeDasharray="4 4" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: "#9f1239", fontSize: 12 }}
                axisLine={{ stroke: "#fda4af" }}
                tickLine={false}
              />
              <YAxis
                ticks={TICKS}
                domain={[0, 10]}
                allowDecimals={false}
                width={36}
                tick={{ fill: "#9f1239", fontSize: 12 }}
                axisLine={{ stroke: "#fda4af" }}
                tickLine={false}
              />
              <Tooltip
                formatter={tooltipFormatter}
                labelFormatter={(_, index) => sparklineData[index]?.dateISO ?? ""}
                contentStyle={{
                  borderRadius: 12,
                  borderColor: "#fb7185",
                  backgroundColor: "white",
                  color: "#881337",
                }}
              />
              <Line
                type="monotone"
                dataKey="pain"
                stroke="#f43f5e"
                strokeWidth={2}
                dot={{ r: 3, stroke: "#f43f5e", strokeWidth: 1, fill: "white" }}
                activeDot={{ r: 5, stroke: "#f43f5e", strokeWidth: 2, fill: "white" }}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

type SummaryTileProps = {
  label: string;
  value: string;
};

function SummaryTile({ label, value }: SummaryTileProps): JSX.Element {
  return (
    <div className="rounded-xl border border-rose-100 bg-white/80 p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-rose-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-rose-900">{value}</p>
    </div>
  );
}
