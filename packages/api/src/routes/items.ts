import { Router, Request, Response } from "express";
import { prisma, Site } from "@price-tracker/shared";
import { dec } from "../serialize";

export const itemsRouter = Router();

const VALID_SITES = Object.values(Site);

function isValidSite(value: unknown): value is Site {
  return typeof value === "string" && (VALID_SITES as string[]).includes(value);
}

function serializePriceCheck(pc: any) {
  return {
    id: pc.id,
    checkedAt: pc.checkedAt,
    price: dec(pc.price),
    listPrice: dec(pc.listPrice),
    isSale: pc.isSale,
    percentOff: dec(pc.percentOff),
    inStock: pc.inStock,
    success: pc.success,
    errorMessage: pc.errorMessage,
  };
}

function serializeTrendAlert(ta: any) {
  return {
    id: ta.id,
    trendType: ta.trendType,
    detectedAt: ta.detectedAt,
    description: ta.description,
    fromPrice: dec(ta.fromPrice),
    toPrice: dec(ta.toPrice),
    percentChange: dec(ta.percentChange),
  };
}

function serializePrediction(pp: any) {
  return {
    id: pp.id,
    generatedAt: pp.generatedAt,
    forDate: pp.forDate,
    predictedPrice: dec(pp.predictedPrice),
    confidence: dec(pp.confidence),
    method: pp.method,
  };
}

// GET /api/items - list all tracked items with each site's latest snapshot.
itemsRouter.get("/", async (_req: Request, res: Response) => {
  const items = await prisma.item.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      sites: {
        include: {
          priceChecks: { orderBy: { checkedAt: "desc" }, take: 1 },
          trendAlerts: { orderBy: { detectedAt: "desc" }, take: 1 },
          predictions: { orderBy: { generatedAt: "desc" }, take: 3 },
        },
      },
    },
  });

  res.json(
    items.map((item) => ({
      id: item.id,
      name: item.name,
      modelNumber: item.modelNumber,
      notes: item.notes,
      createdAt: item.createdAt,
      sites: item.sites.map((s) => ({
        id: s.id,
        site: s.site,
        productUrl: s.productUrl,
        enabled: s.enabled,
        lastCheckedAt: s.lastCheckedAt,
        latestPriceCheck: s.priceChecks[0] ? serializePriceCheck(s.priceChecks[0]) : null,
        latestTrend: s.trendAlerts[0] ? serializeTrendAlert(s.trendAlerts[0]) : null,
        latestPredictions: s.predictions.map(serializePrediction),
      })),
    }))
  );
});

// GET /api/items/:id - full detail including price history per site.
itemsRouter.get("/:id", async (req: Request, res: Response) => {
  const days = Math.min(Number(req.query.days) || 90, 365);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const item = await prisma.item.findUnique({
    where: { id: req.params.id },
    include: {
      sites: {
        include: {
          priceChecks: { where: { checkedAt: { gte: since } }, orderBy: { checkedAt: "asc" } },
          trendAlerts: { orderBy: { detectedAt: "desc" }, take: 20 },
          predictions: { orderBy: { generatedAt: "desc" }, take: 3 },
        },
      },
    },
  });

  if (!item) return res.status(404).json({ error: "Item not found" });

  res.json({
    id: item.id,
    name: item.name,
    modelNumber: item.modelNumber,
    notes: item.notes,
    createdAt: item.createdAt,
    sites: item.sites.map((s) => ({
      id: s.id,
      site: s.site,
      productUrl: s.productUrl,
      enabled: s.enabled,
      lastCheckedAt: s.lastCheckedAt,
      priceHistory: s.priceChecks.map(serializePriceCheck),
      trendAlerts: s.trendAlerts.map(serializeTrendAlert),
      predictions: s.predictions.map(serializePrediction),
    })),
  });
});

// POST /api/items - create a new tracked item with one or more sites.
itemsRouter.post("/", async (req: Request, res: Response) => {
  const { name, modelNumber, notes, sites } = req.body ?? {};

  if (typeof name !== "string" || !name.trim()) return res.status(400).json({ error: "name is required" });
  if (typeof modelNumber !== "string" || !modelNumber.trim())
    return res.status(400).json({ error: "modelNumber is required" });
  if (!Array.isArray(sites) || sites.length === 0)
    return res.status(400).json({ error: "sites must be a non-empty array" });

  for (const s of sites) {
    const siteValue = typeof s === "string" ? s : s?.site;
    if (!isValidSite(siteValue)) {
      return res.status(400).json({ error: `Invalid site: ${JSON.stringify(siteValue)}. Valid values: ${VALID_SITES.join(", ")}` });
    }
  }

  const item = await prisma.item.create({
    data: {
      name: name.trim(),
      modelNumber: modelNumber.trim(),
      notes: typeof notes === "string" ? notes : null,
      sites: {
        create: sites.map((s: any) => ({
          site: typeof s === "string" ? s : s.site,
          productUrl: typeof s === "object" && typeof s.productUrl === "string" ? s.productUrl : null,
        })),
      },
    },
    include: { sites: true },
  });

  res.status(201).json(item);
});

// PATCH /api/items/:id - update item name/modelNumber/notes.
itemsRouter.patch("/:id", async (req: Request, res: Response) => {
  const { name, modelNumber, notes } = req.body ?? {};
  const data: Record<string, unknown> = {};
  if (name !== undefined) data.name = String(name).trim();
  if (modelNumber !== undefined) data.modelNumber = String(modelNumber).trim();
  if (notes !== undefined) data.notes = notes === null ? null : String(notes);

  try {
    const item = await prisma.item.update({ where: { id: req.params.id }, data });
    res.json(item);
  } catch {
    res.status(404).json({ error: "Item not found" });
  }
});

// DELETE /api/items/:id
itemsRouter.delete("/:id", async (req: Request, res: Response) => {
  try {
    await prisma.item.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch {
    res.status(404).json({ error: "Item not found" });
  }
});

// POST /api/items/:id/sites - track an additional site for an existing item.
itemsRouter.post("/:id/sites", async (req: Request, res: Response) => {
  const { site, productUrl } = req.body ?? {};
  if (!isValidSite(site)) {
    return res.status(400).json({ error: `Invalid site. Valid values: ${VALID_SITES.join(", ")}` });
  }

  const item = await prisma.item.findUnique({ where: { id: req.params.id } });
  if (!item) return res.status(404).json({ error: "Item not found" });

  try {
    const itemSite = await prisma.itemSite.create({
      data: { itemId: item.id, site, productUrl: typeof productUrl === "string" ? productUrl : null },
    });
    res.status(201).json(itemSite);
  } catch {
    res.status(409).json({ error: "This site is already tracked for this item." });
  }
});

// PATCH /api/items/:id/sites/:siteId - update productUrl / enabled.
itemsRouter.patch("/:id/sites/:siteId", async (req: Request, res: Response) => {
  const { productUrl, enabled } = req.body ?? {};
  const data: Record<string, unknown> = {};
  if (productUrl !== undefined) data.productUrl = productUrl === null ? null : String(productUrl);
  if (enabled !== undefined) data.enabled = Boolean(enabled);

  try {
    const itemSite = await prisma.itemSite.update({
      where: { id: req.params.siteId, itemId: req.params.id },
      data,
    });
    res.json(itemSite);
  } catch {
    res.status(404).json({ error: "Tracked site not found" });
  }
});

// DELETE /api/items/:id/sites/:siteId
itemsRouter.delete("/:id/sites/:siteId", async (req: Request, res: Response) => {
  try {
    await prisma.itemSite.delete({ where: { id: req.params.siteId, itemId: req.params.id } });
    res.status(204).end();
  } catch {
    res.status(404).json({ error: "Tracked site not found" });
  }
});
