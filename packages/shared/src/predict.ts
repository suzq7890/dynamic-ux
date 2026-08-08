export interface PredictionPoint {
  checkedAt: Date;
  price: number;
}

export interface Prediction {
  forDate: Date;
  predictedPrice: number;
  confidence: number | null;
  method: string;
}

const MIN_POINTS_FOR_REGRESSION = 7;
const LOOKBACK_DAYS = 90;

/**
 * Ordinary least squares over (dayOffset, price). This is a simple linear
 * trend projection, not a real forecasting model - it assumes the recent
 * trend continues linearly, which is a reasonable rough signal for
 * appliance pricing (which tends to move in slow markdown cycles) but will
 * miss step-change events like a new sale event or model year refresh.
 */
function linearRegression(points: { x: number; y: number }[]): { slope: number; intercept: number; rSquared: number } {
  const n = points.length;
  const meanX = points.reduce((s, p) => s + p.x, 0) / n;
  const meanY = points.reduce((s, p) => s + p.y, 0) / n;

  let num = 0;
  let den = 0;
  for (const p of points) {
    num += (p.x - meanX) * (p.y - meanY);
    den += (p.x - meanX) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  const intercept = meanY - slope * meanX;

  let ssRes = 0;
  let ssTot = 0;
  for (const p of points) {
    const predicted = slope * p.x + intercept;
    ssRes += (p.y - predicted) ** 2;
    ssTot += (p.y - meanY) ** 2;
  }
  const rSquared = ssTot === 0 ? 1 : 1 - ssRes / ssTot;

  return { slope, intercept, rSquared };
}

/**
 * Predicts price `daysAhead` days from the most recent data point, using a
 * linear regression over up to LOOKBACK_DAYS of history. Falls back to
 * "flat" prediction (last known price) when there isn't enough history.
 */
export function predictPrice(history: PredictionPoint[], daysAhead: number): Prediction | null {
  if (history.length === 0) return null;

  const sorted = [...history].sort((a, b) => a.checkedAt.getTime() - b.checkedAt.getTime());
  const cutoff = Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000;
  const windowPoints = sorted.filter((p) => p.checkedAt.getTime() >= cutoff);
  const latest = sorted[sorted.length - 1];
  const forDate = new Date(latest.checkedAt.getTime() + daysAhead * 24 * 60 * 60 * 1000);

  if (windowPoints.length < MIN_POINTS_FOR_REGRESSION) {
    return {
      forDate,
      predictedPrice: latest.price,
      confidence: null,
      method: "flat (insufficient history for regression)",
    };
  }

  const baseTime = windowPoints[0].checkedAt.getTime();
  const points = windowPoints.map((p) => ({
    x: (p.checkedAt.getTime() - baseTime) / (24 * 60 * 60 * 1000),
    y: p.price,
  }));

  const { slope, intercept, rSquared } = linearRegression(points);

  const targetX = (forDate.getTime() - baseTime) / (24 * 60 * 60 * 1000);
  const rawPrediction = slope * targetX + intercept;
  const predictedPrice = Math.max(0, Math.round(rawPrediction * 100) / 100);

  return {
    forDate,
    predictedPrice,
    confidence: Math.round(Math.max(0, Math.min(1, rSquared)) * 100) / 100,
    method: "linear-regression-90d",
  };
}
