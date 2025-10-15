import type { CorrelationResult, DayEntry } from "@/lib/types";

function pearson(x: number[], y: number[]): { r: number; p: number } {
  const n = x.length;
  const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
  const meanX = mean(x);
  const meanY = mean(y);
  const numerator = x.reduce((sum, xi, index) => sum + (xi - meanX) * (y[index] - meanY), 0);
  const denominator = Math.sqrt(
    x.reduce((sum, xi) => sum + (xi - meanX) ** 2, 0) * y.reduce((sum, yi) => sum + (yi - meanY) ** 2, 0)
  );
  const r = denominator === 0 ? 0 : numerator / denominator;
  const t = Math.abs(r) * Math.sqrt((n - 2) / (1 - r * r || 1));
  const p = studentTPValue(t, n - 2);
  return { r, p };
}

function studentTPValue(t: number, df: number): number {
  // Approximation using survival function for large df
  const x = df / (df + t * t);
  const a = 0.5 * betaIncomplete(x, df / 2, 0.5);
  return Math.min(1, 2 * a);
}

function betaIncomplete(x: number, a: number, b: number): number {
  // continued fraction approximation (Lentz's algorithm)
  const maxIterations = 100;
  const epsilon = 1e-8;
  let aa = 0;
  let c = 1;
  let d = 1 - (a + b) * x / (a + 1);
  if (Math.abs(d) < epsilon) d = epsilon;
  d = 1 / d;
  let fraction = d;
  for (let m = 1; m <= maxIterations; m++) {
    const m2 = 2 * m;
    aa = (m * (b - m) * x) / ((a + m2 - 1) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < epsilon) d = epsilon;
    c = 1 + aa / c;
    if (Math.abs(c) < epsilon) c = epsilon;
    d = 1 / d;
    fraction *= d * c;
    aa = (-(a + m) * (a + b + m) * x) / ((a + m2) * (a + m2 + 1));
    d = 1 + aa * d;
    if (Math.abs(d) < epsilon) d = epsilon;
    c = 1 + aa / c;
    if (Math.abs(c) < epsilon) c = epsilon;
    d = 1 / d;
    const delta = d * c;
    fraction *= delta;
    if (Math.abs(delta - 1) < epsilon) break;
  }
  return Math.pow(x, a) * Math.pow(1 - x, b) * fraction / a;
}

export function computeCorrelations(dayEntries: DayEntry[]): CorrelationResult[] {
  const results: CorrelationResult[] = [];
  const painSeries = dayEntries.filter((entry) => typeof entry.nrs === "number");
  const pbacSeries = dayEntries.filter((entry) => entry.pbac?.dayScore);

  if (painSeries.length >= 14 && pbacSeries.length >= 14) {
    const paired = painSeries
      .map((entry) => {
        const pbac = dayEntries.find((match) => match.date === entry.date)?.pbac?.dayScore;
        if (pbac === undefined) return null;
        return { pain: entry.nrs ?? 0, pbac };
      })
      .filter((item): item is { pain: number; pbac: number } => item !== null);

    if (paired.length >= 14) {
      const x = paired.map((item) => item.pain);
      const y = paired.map((item) => item.pbac);
      const { r, p } = pearson(x, y);
      results.push({ variableX: "Schmerz (NRS)", variableY: "PBAC", r, p, n: paired.length, reliable: paired.length >= 14 && p < 0.05 });
    }
  }

  return results;
}
