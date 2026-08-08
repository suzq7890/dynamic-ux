import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api, ItemDetail as ItemDetailType, SITE_LABELS } from "../api";
import { SaleBadge, TrendBadge } from "../components/Badges";

export default function ItemDetail() {
  const { id } = useParams<{ id: string }>();
  const [item, setItem] = useState<ItemDetailType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(90);
  const [savingUrlFor, setSavingUrlFor] = useState<string | null>(null);

  function load() {
    if (!id) return;
    api
      .getItem(id, days)
      .then(setItem)
      .catch((e) => setError(e.message));
  }

  useEffect(load, [id, days]);

  if (error) return <div className="panel error">Failed to load item: {error}</div>;
  if (!item) return <div className="panel">Loading...</div>;

  async function saveProductUrl(siteId: string, url: string) {
    if (!id) return;
    setSavingUrlFor(siteId);
    try {
      await api.updateSite(id, siteId, { productUrl: url || null });
      load();
    } finally {
      setSavingUrlFor(null);
    }
  }

  async function toggleEnabled(siteId: string, enabled: boolean) {
    if (!id) return;
    await api.updateSite(id, siteId, { enabled });
    load();
  }

  return (
    <div>
      <h1>{item.name}</h1>
      <p className="muted">Model {item.modelNumber}</p>
      {item.notes && <p className="muted">{item.notes}</p>}

      <div className="range-select">
        <label>
          History range:{" "}
          <select value={days} onChange={(e) => setDays(Number(e.target.value))}>
            <option value={30}>30 days</option>
            <option value={90}>90 days</option>
            <option value={180}>180 days</option>
            <option value={365}>365 days</option>
          </select>
        </label>
      </div>

      {item.sites.map((site) => {
        const chartData = site.priceHistory
          .filter((p) => p.price != null)
          .map((p) => ({ date: new Date(p.checkedAt).toLocaleDateString(), price: p.price }));
        const latest = site.priceHistory[site.priceHistory.length - 1] ?? null;
        const nextPrediction = site.predictions.slice().sort((a, b) => new Date(a.forDate).getTime() - new Date(b.forDate).getTime())[0];

        return (
          <div key={site.id} className="panel">
            <div className="item-header">
              <h2>{SITE_LABELS[site.site]}</h2>
              <label className="enabled-toggle">
                <input type="checkbox" checked={site.enabled} onChange={(e) => toggleEnabled(site.id, e.target.checked)} />
                tracking enabled
              </label>
            </div>

            <div className="site-url-row">
              <label>Product URL:</label>
              <input
                type="text"
                defaultValue={site.productUrl ?? ""}
                placeholder="https://... (paste the exact product page for reliable checks)"
                onBlur={(e) => {
                  if (e.target.value !== (site.productUrl ?? "")) saveProductUrl(site.id, e.target.value.trim());
                }}
              />
              {savingUrlFor === site.id && <span className="muted">saving...</span>}
            </div>

            {latest && (
              <div className="latest-summary">
                <span className={latest.isSale ? "price-sale" : ""}>{latest.price != null ? `$${latest.price.toFixed(2)}` : "no price"}</span>
                <SaleBadge isSale={latest.isSale} percentOff={latest.percentOff} />
                {nextPrediction?.predictedPrice != null && (
                  <span className="muted">
                    Predicted ~${nextPrediction.predictedPrice.toFixed(2)} by {new Date(nextPrediction.forDate).toLocaleDateString()}
                    {nextPrediction.confidence != null ? ` (confidence ${Math.round(nextPrediction.confidence * 100)}%)` : ""}
                  </span>
                )}
              </div>
            )}

            {chartData.length > 1 ? (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis domain={["auto", "auto"]} tick={{ fontSize: 11 }} width={60} />
                  <Tooltip formatter={(v: number) => `$${v.toFixed(2)}`} />
                  <Line type="monotone" dataKey="price" stroke="#3b6ea5" dot={false} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="muted">Not enough history yet to chart a trend.</p>
            )}

            {site.trendAlerts.length > 0 && (
              <div className="trend-list">
                <h3>Recent trend alerts</h3>
                <ul>
                  {site.trendAlerts.map((t) => (
                    <li key={t.id}>
                      <TrendBadge trend={t} /> {t.description} <span className="muted">{new Date(t.detectedAt).toLocaleDateString()}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
