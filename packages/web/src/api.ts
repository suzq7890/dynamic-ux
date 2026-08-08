const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api";

export type SiteKey = "LOWES" | "HOME_DEPOT" | "BEST_BUY" | "FRIGIDAIRE";

export const SITE_LABELS: Record<SiteKey, string> = {
  LOWES: "Lowe's",
  HOME_DEPOT: "Home Depot",
  BEST_BUY: "Best Buy",
  FRIGIDAIRE: "Frigidaire",
};

export const ALL_SITES: SiteKey[] = ["LOWES", "HOME_DEPOT", "BEST_BUY", "FRIGIDAIRE"];

export interface PriceCheck {
  id: string;
  checkedAt: string;
  price: number | null;
  listPrice: number | null;
  isSale: boolean;
  percentOff: number | null;
  inStock: boolean | null;
  success: boolean;
  errorMessage: string | null;
}

export interface TrendAlert {
  id: string;
  trendType: "RISING" | "FALLING" | "VOLATILE";
  detectedAt: string;
  description: string;
  fromPrice: number | null;
  toPrice: number | null;
  percentChange: number | null;
}

export interface Prediction {
  id: string;
  generatedAt: string;
  forDate: string;
  predictedPrice: number | null;
  confidence: number | null;
  method: string;
}

export interface ItemSiteSummary {
  id: string;
  site: SiteKey;
  productUrl: string | null;
  enabled: boolean;
  lastCheckedAt: string | null;
  latestPriceCheck: PriceCheck | null;
  latestTrend: TrendAlert | null;
  latestPredictions: Prediction[];
}

export interface ItemSummary {
  id: string;
  name: string;
  modelNumber: string;
  notes: string | null;
  createdAt: string;
  sites: ItemSiteSummary[];
}

export interface ItemSiteDetail {
  id: string;
  site: SiteKey;
  productUrl: string | null;
  enabled: boolean;
  lastCheckedAt: string | null;
  priceHistory: PriceCheck[];
  trendAlerts: TrendAlert[];
  predictions: Prediction[];
}

export interface ItemDetail {
  id: string;
  name: string;
  modelNumber: string;
  notes: string | null;
  createdAt: string;
  sites: ItemSiteDetail[];
}

export interface TodayRow {
  itemId: string;
  itemName: string;
  modelNumber: string;
  itemSiteId: string;
  site: SiteKey;
  productUrl: string | null;
  enabled: boolean;
  checkedAt: string | null;
  price: number | null;
  listPrice: number | null;
  isSale: boolean;
  percentOff: number | null;
  inStock: boolean | null;
  lastCheckSucceeded: boolean | null;
  lastCheckError: string | null;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed: ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  getToday: () => request<TodayRow[]>("/today"),
  listItems: () => request<ItemSummary[]>("/items"),
  getItem: (id: string, days = 90) => request<ItemDetail>(`/items/${id}?days=${days}`),
  createItem: (data: { name: string; modelNumber: string; notes?: string; sites: { site: SiteKey; productUrl?: string }[] }) =>
    request<ItemDetail>("/items", { method: "POST", body: JSON.stringify(data) }),
  updateItem: (id: string, data: { name?: string; modelNumber?: string; notes?: string | null }) =>
    request<ItemDetail>(`/items/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteItem: (id: string) => request<void>(`/items/${id}`, { method: "DELETE" }),
  addSite: (itemId: string, data: { site: SiteKey; productUrl?: string }) =>
    request(`/items/${itemId}/sites`, { method: "POST", body: JSON.stringify(data) }),
  updateSite: (itemId: string, siteId: string, data: { productUrl?: string | null; enabled?: boolean }) =>
    request(`/items/${itemId}/sites/${siteId}`, { method: "PATCH", body: JSON.stringify(data) }),
  removeSite: (itemId: string, siteId: string) => request<void>(`/items/${itemId}/sites/${siteId}`, { method: "DELETE" }),
};
