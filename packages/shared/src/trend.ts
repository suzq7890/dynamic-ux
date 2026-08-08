export type TrendType = "RISING" | "FALLING" | "VOLATILE";

export interface TrendPoint {
  checkedAt: Date;
  price: number;
}

export interface TrendResult {
  trendType: TrendType;
  description: string;
  fromPrice: number;
  toPrice: number;
  percentChange: number;
}

const MIN_POINTS = 4;
const WINDOW_DAYS = 14;
const RISING_FALLING_THRESHOLD_PCT = 3;
const VOLATILITY_STDDEV_PCT_THRESHOLD = 2.5;

function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * Looks at the most recent price history within WINDOW_DAYS and classifies
 * a trend if one is present. Returns null when there isn't enough data or
 * the price has been essentially flat.
 */
export function detectTrend(history: TrendPoint[]): TrendResult | null {
  const sorted = [...history].sort((a, b) => a.checkedAt.getTime() - b.checkedAt.getTime());
  const cutoff = Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const windowPoints = sorted.filter((p) => p.checkedAt.getTime() >= cutoff);

  if (windowPoints.length < MIN_POINTS) return null;

  const fromPrice = windowPoints[0].price;
  const toPrice = windowPoints[windowPoints.length - 1].price;
  const percentChange = Math.round(((toPrice - fromPrice) / fromPrice) * 1000) / 10;

  const dayPctChanges: number[] = [];
  for (let i = 1; i < windowPoints.length; i++) {
    const prev = windowPoints[i - 1].price;
    const curr = windowPoints[i].price;
    dayPctChanges.push(((curr - prev) / prev) * 100);
  }
  const volatility = stddev(dayPctChanges);

  if (Math.abs(percentChange) < RISING_FALLING_THRESHOLD_PCT && volatility >= VOLATILITY_STDDEV_PCT_THRESHOLD) {
    return {
      trendType: "VOLATILE",
      description: `Price has been fluctuating over the last ${WINDOW_DAYS} days (swinging between checks) without a clear direction.`,
      fromPrice,
      toPrice,
      percentChange,
    };
  }

  if (percentChange <= -RISING_FALLING_THRESHOLD_PCT) {
    return {
      trendType: "FALLING",
      description: `Price has dropped ${Math.abs(percentChange)}% over the last ${WINDOW_DAYS} days ($${fromPrice.toFixed(2)} → $${toPrice.toFixed(2)}).`,
      fromPrice,
      toPrice,
      percentChange,
    };
  }

  if (percentChange >= RISING_FALLING_THRESHOLD_PCT) {
    return {
      trendType: "RISING",
      description: `Price has risen ${percentChange}% over the last ${WINDOW_DAYS} days ($${fromPrice.toFixed(2)} → $${toPrice.toFixed(2)}).`,
      fromPrice,
      toPrice,
      percentChange,
    };
  }

  return null;
}
