// src/components/admin/charts.tsx
// Minimal server-rendered SVG charts for the newsletter Performance area.
// No client JS: hover values ride on native <title> tooltips. Series colors
// are a CVD-validated blue/orange pair (per mode), set as CSS vars on the
// wrapper so the .dark class swaps them; text wears the admin text tokens.
import type { ReactElement } from "react";

export type ChartPoint = { label: string; value: number };

const W = 640;
const PAD_X = 6;
const LABEL_H = 18;

// Validated against both admin surfaces (dataviz six-checks validator).
const SERIES_VARS =
  "[--s1:#2a78d6] [--s2:#eb6834] dark:[--s1:#3987e5] dark:[--s2:#d95926]";

function Legend({ items }: { items: { color: string; label: string }[] }) {
  return (
    <div className="mb-1 flex flex-wrap items-center gap-3">
      {items.map((item) => (
        <span
          key={item.label}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
        >
          <span
            aria-hidden
            className="inline-block h-2.5 w-2.5 rounded-[2px]"
            style={{ background: item.color }}
          />
          {item.label}
        </span>
      ))}
    </div>
  );
}

// Sparse x labels: first, last, and up to two interior ticks.
function tickIndexes(count: number): number[] {
  if (count <= 4) return Array.from({ length: count }, (_, i) => i);
  const mid1 = Math.round((count - 1) / 3);
  const mid2 = Math.round(((count - 1) * 2) / 3);
  return [0, mid1, mid2, count - 1];
}

function XLabels({
  labels,
  slot,
  height,
}: {
  labels: string[];
  slot: number;
  height: number;
}) {
  const ticks = tickIndexes(labels.length);
  return (
    <>
      {ticks.map((i) => (
        <text
          key={i}
          x={PAD_X + i * slot + slot / 2}
          y={height - 4}
          textAnchor={i === 0 ? "start" : i === labels.length - 1 ? "end" : "middle"}
          className="fill-muted-foreground"
          fontSize={10}
        >
          {labels[i]}
        </text>
      ))}
    </>
  );
}

// Single-series bars, thin marks with a 2px gap and rounded data ends.
export function BarChart({
  points,
  height = 140,
  ariaLabel,
  formatValue = (n) => String(n),
}: {
  points: ChartPoint[];
  height?: number;
  ariaLabel: string;
  formatValue?: (n: number) => string;
}): ReactElement {
  const plotH = height - LABEL_H;
  const max = Math.max(1, ...points.map((p) => p.value));
  const slot = (W - PAD_X * 2) / Math.max(1, points.length);
  const barW = Math.max(2, Math.min(28, slot - 2));

  return (
    <div className={SERIES_VARS}>
      <svg
        viewBox={`0 0 ${W} ${height}`}
        width="100%"
        role="img"
        aria-label={ariaLabel}
      >
        <line
          x1={PAD_X}
          x2={W - PAD_X}
          y1={plotH}
          y2={plotH}
          className="stroke-border"
          strokeWidth={1}
        />
        {points.map((p, i) => {
          const h = Math.round((p.value / max) * (plotH - 8));
          return (
            <rect
              key={`${p.label}-${i}`}
              x={PAD_X + i * slot + (slot - barW) / 2}
              y={plotH - h}
              width={barW}
              height={Math.max(h, p.value > 0 ? 2 : 0)}
              rx={2}
              fill="var(--s1)"
            >
              <title>{`${p.label}: ${formatValue(p.value)}`}</title>
            </rect>
          );
        })}
        <XLabels labels={points.map((p) => p.label)} slot={slot} height={height} />
      </svg>
    </div>
  );
}

// Two series side by side per bucket (signups vs unsubscribes).
export function DualBarChart({
  points,
  aLabel,
  bLabel,
  height = 160,
  ariaLabel,
}: {
  points: { label: string; a: number; b: number }[];
  aLabel: string;
  bLabel: string;
  height?: number;
  ariaLabel: string;
}): ReactElement {
  const plotH = height - LABEL_H;
  const max = Math.max(1, ...points.flatMap((p) => [p.a, p.b]));
  const slot = (W - PAD_X * 2) / Math.max(1, points.length);
  const barW = Math.max(2, Math.min(16, slot / 2 - 3));

  return (
    <div className={SERIES_VARS}>
      <Legend
        items={[
          { color: "var(--s1)", label: aLabel },
          { color: "var(--s2)", label: bLabel },
        ]}
      />
      <svg
        viewBox={`0 0 ${W} ${height}`}
        width="100%"
        role="img"
        aria-label={ariaLabel}
      >
        <line
          x1={PAD_X}
          x2={W - PAD_X}
          y1={plotH}
          y2={plotH}
          className="stroke-border"
          strokeWidth={1}
        />
        {points.map((p, i) => {
          const center = PAD_X + i * slot + slot / 2;
          const hA = Math.round((p.a / max) * (plotH - 8));
          const hB = Math.round((p.b / max) * (plotH - 8));
          return (
            <g key={`${p.label}-${i}`}>
              <rect
                x={center - barW - 1}
                y={plotH - hA}
                width={barW}
                height={Math.max(hA, p.a > 0 ? 2 : 0)}
                rx={2}
                fill="var(--s1)"
              >
                <title>{`${p.label}, ${aLabel}: ${p.a}`}</title>
              </rect>
              <rect
                x={center + 1}
                y={plotH - hB}
                width={barW}
                height={Math.max(hB, p.b > 0 ? 2 : 0)}
                rx={2}
                fill="var(--s2)"
              >
                <title>{`${p.label}, ${bLabel}: ${p.b}`}</title>
              </rect>
            </g>
          );
        })}
        <XLabels labels={points.map((p) => p.label)} slot={slot} height={height} />
      </svg>
    </div>
  );
}

// Cumulative step lines (activity after a send), up to two series.
export function StepLineChart({
  series,
  height = 160,
  ariaLabel,
}: {
  series: { name: string; points: ChartPoint[] }[];
  height?: number;
  ariaLabel: string;
}): ReactElement {
  const plotH = height - LABEL_H;
  const labels = series[0]?.points.map((p) => p.label) ?? [];
  const max = Math.max(1, ...series.flatMap((s) => s.points.map((p) => p.value)));
  const slot = (W - PAD_X * 2) / Math.max(1, labels.length);
  const colors = ["var(--s1)", "var(--s2)"];

  const stepPath = (points: ChartPoint[]): string => {
    let d = "";
    points.forEach((p, i) => {
      const x = PAD_X + i * slot + slot / 2;
      const y = plotH - 6 - (p.value / max) * (plotH - 16);
      d += i === 0 ? `M ${x} ${y}` : ` H ${x}`;
      d += ` V ${y}`;
    });
    return d;
  };

  return (
    <div className={SERIES_VARS}>
      <Legend
        items={series.map((s, i) => ({ color: colors[i % 2], label: s.name }))}
      />
      <svg
        viewBox={`0 0 ${W} ${height}`}
        width="100%"
        role="img"
        aria-label={ariaLabel}
      >
        <line
          x1={PAD_X}
          x2={W - PAD_X}
          y1={plotH}
          y2={plotH}
          className="stroke-border"
          strokeWidth={1}
        />
        {series.map((s, si) => (
          <path
            key={s.name}
            d={stepPath(s.points)}
            fill="none"
            stroke={colors[si % 2]}
            strokeWidth={2}
            strokeLinejoin="round"
          >
            <title>{`${s.name}: ${s.points[s.points.length - 1]?.value ?? 0} total`}</title>
          </path>
        ))}
        {/* Direct end labels: final value per series in text ink. */}
        {series.map((s, si) => {
          const lastPoint = s.points[s.points.length - 1];
          if (!lastPoint) return null;
          const x = PAD_X + (s.points.length - 1) * slot + slot / 2;
          const y = plotH - 6 - (lastPoint.value / max) * (plotH - 16);
          return (
            <text
              key={`label-${s.name}`}
              x={Math.min(x + 4, W - PAD_X)}
              y={Math.max(10, y - 4 - si * 12)}
              textAnchor="end"
              className="fill-muted-foreground"
              fontSize={10}
            >
              {`${s.name} ${lastPoint.value}`}
            </text>
          );
        })}
        <XLabels labels={labels} slot={slot} height={height} />
      </svg>
    </div>
  );
}
