import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ALL_SITES, api, SITE_LABELS, SiteKey } from "../api";

export default function AddItem() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [modelNumber, setModelNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedSites, setSelectedSites] = useState<Record<SiteKey, boolean>>({
    LOWES: false,
    HOME_DEPOT: false,
    BEST_BUY: false,
    FRIGIDAIRE: false,
  });
  const [productUrls, setProductUrls] = useState<Record<SiteKey, string>>({
    LOWES: "",
    HOME_DEPOT: "",
    BEST_BUY: "",
    FRIGIDAIRE: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const sites = ALL_SITES.filter((s) => selectedSites[s]).map((s) => ({
      site: s,
      productUrl: productUrls[s].trim() || undefined,
    }));

    if (!name.trim() || !modelNumber.trim() || sites.length === 0) {
      setError("Name, model number, and at least one website are required.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const item = await api.createItem({ name: name.trim(), modelNumber: modelNumber.trim(), notes: notes.trim() || undefined, sites });
      navigate(`/items/${item.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="panel">
      <h1>Track a New Item</h1>
      <form onSubmit={handleSubmit} className="add-item-form">
        <label>
          Item name
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Frigidaire Gallery Gas Range" />
        </label>

        <label>
          Model number
          <input value={modelNumber} onChange={(e) => setModelNumber(e.target.value)} placeholder="e.g. GCFG3070BF" />
        </label>

        <label>
          Notes (optional)
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </label>

        <fieldset>
          <legend>Websites to check</legend>
          {ALL_SITES.map((site) => (
            <div key={site} className="site-checkbox-row">
              <label className="site-checkbox">
                <input
                  type="checkbox"
                  checked={selectedSites[site]}
                  onChange={(e) => setSelectedSites((prev) => ({ ...prev, [site]: e.target.checked }))}
                />
                {SITE_LABELS[site]}
              </label>
              {selectedSites[site] && (
                <input
                  type="text"
                  className="site-url-input"
                  placeholder="Product URL (optional - improves reliability if provided)"
                  value={productUrls[site]}
                  onChange={(e) => setProductUrls((prev) => ({ ...prev, [site]: e.target.value }))}
                />
              )}
            </div>
          ))}
        </fieldset>

        {error && <div className="error">{error}</div>}

        <button type="submit" disabled={submitting}>
          {submitting ? "Adding..." : "Add Item"}
        </button>
      </form>
    </div>
  );
}
