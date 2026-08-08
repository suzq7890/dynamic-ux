import type { Site } from "@price-tracker/shared";

export interface SiteAdapter {
  site: Site;
  label: string;
  baseUrl: string;
  /** Builds a search-results URL for a given query (e.g. a model number). */
  buildSearchUrl(query: string): string;
  /**
   * Regex tested against candidate `href` values on the search results page
   * to bias toward real product-detail links (as opposed to nav/category
   * links that might also happen to contain the model number in a tracking
   * param). Optional - falls back to text-matching only.
   */
  productPathHint?: RegExp;
}
