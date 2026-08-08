import { Site } from "@price-tracker/shared";
import { SiteAdapter } from "./types";

export const bestBuyAdapter: SiteAdapter = {
  site: Site.BEST_BUY,
  label: "Best Buy",
  baseUrl: "https://www.bestbuy.com",
  buildSearchUrl: (query) => `https://www.bestbuy.com/site/searchpage.jsp?st=${encodeURIComponent(query)}`,
  productPathHint: /\.p\?/i,
};
