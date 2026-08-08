import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ItemSummary, SITE_LABELS } from "../api";
import { SaleBadge, StatusBadge, TrendBadge } from "../components/Badges";

export default function Dashboard() {
  const [items, setItems] = useState<ItemSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .listItems()
      .then(setItems)
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="panel error">Failed to load items: {error}</div>;
  if (!items) return <div className="panel">Loading...</div>;
  if (items.length === 0) {
    return (
      <div className="panel">
        No items tracked yet. <Link to="/add">Add your first item</Link>.
      </div>
    );
  }

  return (
    <div>
      <h1>Today's Prices</h1>
      {items.map((item) => (
        <div key={item.id} className="panel">
          <div className="item-header">
            <h2>
              <Link to={`/items/${item.id}`}>{item.name}</Link>
            </h2>
            <span className="muted">Model {item.modelNumber}</span>
          </div>
          <table className="price-table">
            <thead>
              <tr>
                <th>Site</th>
                <th>Price</th>
                <th>Regular price</th>
                <th></th>
                <th>Trend</th>
                <th>Last checked</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {item.sites.map((s) => (
                <tr key={s.id}>
                  <td>{SITE_LABELS[s.site]}</td>
                  <td className={s.latestPriceCheck?.isSale ? "price-sale" : ""}>
                    {s.latestPriceCheck?.price != null ? `$${s.latestPriceCheck.price.toFixed(2)}` : "—"}
                  </td>
                  <td>
                    {s.latestPriceCheck?.isSale && s.latestPriceCheck.listPrice != null
                      ? `$${s.latestPriceCheck.listPrice.toFixed(2)}`
                      : ""}
                  </td>
                  <td>
                    <SaleBadge isSale={s.latestPriceCheck?.isSale ?? false} percentOff={s.latestPriceCheck?.percentOff ?? null} />
                  </td>
                  <td>
                    <TrendBadge trend={s.latestTrend} />
                  </td>
                  <td className="muted">{s.lastCheckedAt ? new Date(s.lastCheckedAt).toLocaleString() : "never"}</td>
                  <td>
                    <StatusBadge success={s.latestPriceCheck?.success ?? null} errorMessage={s.latestPriceCheck?.errorMessage} />
                    {s.productUrl && (
                      <a href={s.productUrl} target="_blank" rel="noreferrer" className="ext-link">
                        view →
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
