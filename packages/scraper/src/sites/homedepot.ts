import { Site } from "@price-tracker/shared";
import { SiteAdapter } from "./types";

export const homeDepotAdapter: SiteAdapter = {
  site: Site.HOME_DEPOT,
  label: "Home Depot",
  baseUrl: "https://www.homedepot.com",
  buildSearchUrl: (query) => `https://www.homedepot.com/s/${encodeURIComponent(query)}`,
  productPathHint: /\/p\//i,
};
