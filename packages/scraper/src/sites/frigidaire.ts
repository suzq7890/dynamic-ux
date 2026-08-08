import { Site } from "@price-tracker/shared";
import { SiteAdapter } from "./types";

/**
 * NOTE: frigidaire.com's search path and whether it even sells directly
 * (vs. linking out to retailers) is unverified from this environment. This
 * is a best-effort default - if it doesn't resolve a product page, set the
 * ItemSite.productUrl manually from the UI instead of relying on search.
 */
export const frigidaireAdapter: SiteAdapter = {
  site: Site.FRIGIDAIRE,
  label: "Frigidaire",
  baseUrl: "https://www.frigidaire.com",
  buildSearchUrl: (query) => `https://www.frigidaire.com/search/?q=${encodeURIComponent(query)}`,
  productPathHint: /\/(range|appliances)\//i,
};
