import { TrendAlert } from "../api";

export function TrendBadge({ trend }: { trend: TrendAlert | null }) {
  if (!trend) return null;
  const cls =
    trend.trendType === "FALLING" ? "badge badge-green" : trend.trendType === "RISING" ? "badge badge-red" : "badge badge-amber";
  const arrow = trend.trendType === "FALLING" ? "↓" : trend.trendType === "RISING" ? "↑" : "↕";
  return (
    <span className={cls} title={trend.description}>
      {arrow} {trend.trendType.toLowerCase()}
    </span>
  );
}

export function SaleBadge({ isSale, percentOff }: { isSale: boolean; percentOff: number | null }) {
  if (!isSale) return null;
  return <span className="badge badge-sale">On sale{percentOff ? ` · ${percentOff}% off` : ""}</span>;
}

export function StatusBadge({ success, errorMessage }: { success: boolean | null; errorMessage?: string | null }) {
  if (success === null) return <span className="badge badge-muted">no data yet</span>;
  if (success) return null;
  return (
    <span className="badge badge-red" title={errorMessage ?? undefined}>
      check failed
    </span>
  );
}
