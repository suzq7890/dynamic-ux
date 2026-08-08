import { Router, Request, Response } from "express";
import { prisma } from "@price-tracker/shared";
import { dec } from "../serialize";

export const todayRouter = Router();

// GET /api/today - the latest known price for every tracked item/site pair,
// flattened for the dashboard's "today's prices" view.
todayRouter.get("/", async (_req: Request, res: Response) => {
  const itemSites = await prisma.itemSite.findMany({
    include: {
      item: true,
      priceChecks: { orderBy: { checkedAt: "desc" }, take: 1 },
    },
    orderBy: { item: { name: "asc" } },
  });

  res.json(
    itemSites.map((s) => {
      const latest = s.priceChecks[0] ?? null;
      return {
        itemId: s.itemId,
        itemName: s.item.name,
        modelNumber: s.item.modelNumber,
        itemSiteId: s.id,
        site: s.site,
        productUrl: s.productUrl,
        enabled: s.enabled,
        checkedAt: latest?.checkedAt ?? null,
        price: latest ? dec(latest.price) : null,
        listPrice: latest ? dec(latest.listPrice) : null,
        isSale: latest?.isSale ?? false,
        percentOff: latest ? dec(latest.percentOff) : null,
        inStock: latest?.inStock ?? null,
        lastCheckSucceeded: latest?.success ?? null,
        lastCheckError: latest?.errorMessage ?? null,
      };
    })
  );
});
