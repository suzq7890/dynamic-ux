import { Site } from "@price-tracker/shared";
import { SiteAdapter } from "./types";

export const lowesAdapter: SiteAdapter = {
  site: Site.LOWES,
  label: "Lowe's",
  baseUrl: "https://www.lowes.com",
  buildSearchUrl: (query) => `https://www.lowes.com/search?searchTerm=${encodeURIComponent(query)}`,
  productPathHint: /\/pd\//i,
};
