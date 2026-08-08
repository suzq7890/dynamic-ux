import type { Site } from "@price-tracker/shared";
import { SiteAdapter } from "./types";
import { lowesAdapter } from "./lowes";
import { homeDepotAdapter } from "./homedepot";
import { bestBuyAdapter } from "./bestbuy";
import { frigidaireAdapter } from "./frigidaire";

export const siteAdapters: Record<Site, SiteAdapter> = {
  LOWES: lowesAdapter,
  HOME_DEPOT: homeDepotAdapter,
  BEST_BUY: bestBuyAdapter,
  FRIGIDAIRE: frigidaireAdapter,
} as Record<Site, SiteAdapter>;

export type { SiteAdapter } from "./types";
