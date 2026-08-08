import {
  prisma,
  extractPriceFromHtml,
  detectTrend,
  predictPrice,
  loadEmailConfigFromEnv,
  sendSaleAlertEmail,
  sendTrendAlertEmail,
  Site,
} from "@price-tracker/shared";
import { fetchRenderedHtml, closeBrowser } from "./browser";
import { resolveProductUrl } from "./resolveUrl";
import { siteAdapters } from "./sites";

const TREND_ALERT_COOLDOWN_DAYS = 7;
const TREND_LOOKBACK_DAYS = 30;
const PREDICTION_HORIZONS_DAYS = [7, 14, 30];

function toNum(d: unknown): number | null {
  if (d === null || d === undefined) return null;
  const n = Number(d);
  return Number.isFinite(n) ? n : null;
}

async function processItemSite(itemSiteId: string): Promise<void> {
  const itemSite = await prisma.itemSite.findUniqueOrThrow({
    where: { id: itemSiteId },
    include: { item: true },
  });
  const adapter = siteAdapters[itemSite.site as Site];
  const emailConfig = loadEmailConfigFromEnv();

  let productUrl = itemSite.productUrl;
  try {
    if (!productUrl) {
      console.log(`[${adapter.label}] No productUrl set for "${itemSite.item.name}" - attempting search resolution...`);
      productUrl = await resolveProductUrl(adapter, itemSite.item.modelNumber);
      if (productUrl) {
        await prisma.itemSite.update({ where: { id: itemSite.id }, data: { productUrl } });
        console.log(`[${adapter.label}] Resolved and cached product URL: ${productUrl}`);
      }
    }

    if (!productUrl) {
      await prisma.priceCheck.create({
        data: {
          itemSiteId: itemSite.id,
          success: false,
          errorMessage: "Could not resolve a product URL via search. Set ItemSite.productUrl manually.",
        },
      });
      return;
    }

    const html = await fetchRenderedHtml(productUrl);
    const extracted = extractPriceFromHtml(html);

    if (extracted.price === null) {
      await prisma.priceCheck.create({
        data: {
          itemSiteId: itemSite.id,
          success: false,
          errorMessage: "Price not found on page (site may have changed layout or blocked the request).",
        },
      });
      return;
    }

    await prisma.priceCheck.create({
      data: {
        itemSiteId: itemSite.id,
        price: extracted.price,
        listPrice: extracted.listPrice ?? undefined,
        isSale: extracted.isSale,
        percentOff: extracted.percentOff ?? undefined,
        inStock: extracted.inStock ?? undefined,
        success: true,
      },
    });
    await prisma.itemSite.update({ where: { id: itemSite.id }, data: { lastCheckedAt: new Date() } });

    // --- Sale alert -----------------------------------------------------
    if (extracted.isSale && extracted.listPrice && emailConfig) {
      const lastNotified = toNum(itemSite.lastSaleNotifiedPrice);
      if (lastNotified !== extracted.price) {
        await sendSaleAlertEmail(emailConfig, {
          itemName: itemSite.item.name,
          modelNumber: itemSite.item.modelNumber,
          site: itemSite.site,
          price: extracted.price,
          listPrice: extracted.listPrice,
          percentOff: extracted.percentOff ?? Math.round(((extracted.listPrice - extracted.price) / extracted.listPrice) * 1000) / 10,
          productUrl,
        });
        await prisma.itemSite.update({
          where: { id: itemSite.id },
          data: { lastSaleNotifiedPrice: extracted.price, lastSaleNotifiedAt: new Date() },
        });
        console.log(`[${adapter.label}] Sale alert sent for "${itemSite.item.name}".`);
      }
    }

    // --- Trend detection --------------------------------------------------
    const cutoff = new Date(Date.now() - TREND_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
    const history = await prisma.priceCheck.findMany({
      where: { itemSiteId: itemSite.id, success: true, price: { not: null }, checkedAt: { gte: cutoff } },
      orderBy: { checkedAt: "asc" },
    });
    const trendPoints = history.map((h) => ({ checkedAt: h.checkedAt, price: toNum(h.price)! }));
    const trend = detectTrend(trendPoints);

    if (trend) {
      const cooldownCutoff = new Date(Date.now() - TREND_ALERT_COOLDOWN_DAYS * 24 * 60 * 60 * 1000);
      const recentSameTrend = await prisma.trendAlert.findFirst({
        where: { itemSiteId: itemSite.id, trendType: trend.trendType, detectedAt: { gte: cooldownCutoff } },
      });
      if (!recentSameTrend) {
        await prisma.trendAlert.create({
          data: {
            itemSiteId: itemSite.id,
            trendType: trend.trendType,
            description: trend.description,
            fromPrice: trend.fromPrice,
            toPrice: trend.toPrice,
            percentChange: trend.percentChange,
            emailed: Boolean(emailConfig),
          },
        });
        if (emailConfig) {
          await sendTrendAlertEmail(emailConfig, {
            itemName: itemSite.item.name,
            modelNumber: itemSite.item.modelNumber,
            site: itemSite.site,
            trendType: trend.trendType,
            description: trend.description,
            productUrl,
          });
          console.log(`[${adapter.label}] Trend alert (${trend.trendType}) sent for "${itemSite.item.name}".`);
        }
      }
    }

    // --- Prediction update -------------------------------------------------
    const fullHistory = await prisma.priceCheck.findMany({
      where: { itemSiteId: itemSite.id, success: true, price: { not: null } },
      orderBy: { checkedAt: "asc" },
    });
    const predictionPoints = fullHistory.map((h) => ({ checkedAt: h.checkedAt, price: toNum(h.price)! }));
    for (const daysAhead of PREDICTION_HORIZONS_DAYS) {
      const prediction = predictPrice(predictionPoints, daysAhead);
      if (!prediction) continue;
      await prisma.pricePrediction.create({
        data: {
          itemSiteId: itemSite.id,
          forDate: prediction.forDate,
          predictedPrice: prediction.predictedPrice,
          confidence: prediction.confidence ?? undefined,
          method: prediction.method,
        },
      });
    }
  } catch (err) {
    console.error(`[${adapter.label}] Error processing "${itemSite.item.name}":`, err);
    await prisma.priceCheck.create({
      data: {
        itemSiteId: itemSite.id,
        success: false,
        errorMessage: err instanceof Error ? err.message.slice(0, 500) : String(err).slice(0, 500),
      },
    });
  }
}

export async function runDailyPriceCheck(): Promise<void> {
  const emailConfig = loadEmailConfigFromEnv();
  if (!emailConfig) {
    console.warn("GMAIL_USER / GMAIL_APP_PASSWORD / ALERT_EMAIL_TO not fully set - alert emails will be skipped.");
  }

  const itemSites = await prisma.itemSite.findMany({ where: { enabled: true }, select: { id: true } });
  console.log(`Checking ${itemSites.length} tracked item/site pairs...`);

  for (const { id } of itemSites) {
    await processItemSite(id);
  }

  await closeBrowser();
  console.log("Daily price check complete.");
}
