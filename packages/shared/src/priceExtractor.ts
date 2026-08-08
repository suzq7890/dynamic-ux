export interface ExtractedPrice {
  price: number | null;
  listPrice: number | null;
  isSale: boolean;
  percentOff: number | null;
  inStock: boolean | null;
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const n = typeof value === "string" ? Number(value.replace(/[^0-9.]/g, "")) : Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Walks a JSON-LD payload (which may be a single object, an array, or a
 * {"@graph": [...]} wrapper) and returns every node whose @type mentions
 * "Product".
 */
function findProductNodes(node: unknown, out: any[] = []): any[] {
  if (Array.isArray(node)) {
    for (const item of node) findProductNodes(item, out);
    return out;
  }
  if (node && typeof node === "object") {
    const obj = node as Record<string, unknown>;
    const type = obj["@type"];
    const typeList = Array.isArray(type) ? type : [type];
    if (typeList.some((t) => typeof t === "string" && t.toLowerCase() === "product")) {
      out.push(obj);
    }
    if (obj["@graph"]) findProductNodes(obj["@graph"], out);
  }
  return out;
}

function extractFromJsonLd(html: string): { price: number | null; inStock: boolean | null } {
  const scriptRe = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = scriptRe.exec(html))) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(match[1].trim());
    } catch {
      continue;
    }
    const products = findProductNodes(parsed);
    for (const product of products) {
      let offers = product.offers;
      if (!offers) continue;
      if (!Array.isArray(offers)) offers = [offers];
      for (const offer of offers) {
        const price = toNumber(offer.price ?? offer.lowPrice ?? offer.priceSpecification?.price);
        if (price !== null) {
          const availability = String(offer.availability ?? "").toLowerCase();
          const inStock = availability
            ? availability.includes("instock") || availability.includes("in_stock")
            : null;
          return { price, inStock };
        }
      }
    }
  }
  return { price: null, inStock: null };
}

function extractFromMetaTags(html: string): number | null {
  const patterns = [
    /<meta[^>]+property=["']product:price:amount["'][^>]+content=["']([\d.,]+)["']/i,
    /<meta[^>]+content=["']([\d.,]+)["'][^>]+property=["']product:price:amount["']/i,
    /<meta[^>]+property=["']og:price:amount["'][^>]+content=["']([\d.,]+)["']/i,
    /<meta[^>]+itemprop=["']price["'][^>]+content=["']([\d.,]+)["']/i,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m) return toNumber(m[1]);
  }
  return null;
}

/**
 * Best-effort scan of the raw page text for "was $X" / "save $X" / "N% off"
 * phrasing. Retailers rarely expose the original/list price via structured
 * data, so this text-pattern fallback is what drives sale detection. It is
 * inherently fuzzier than the JSON-LD price and should be treated as a
 * signal, not ground truth.
 */
function extractSaleSignal(html: string, currentPrice: number | null): { listPrice: number | null; percentOff: number | null } {
  const text = html.replace(/\s+/g, " ");

  const wasMatch = text.match(/\bwas\b[^$]{0,10}\$\s?([\d,]+\.\d{2})/i)
    ?? text.match(/\breg(?:ular)?\.?\s*price[^$]{0,10}\$\s?([\d,]+\.\d{2})/i)
    ?? text.match(/\bstrike[^>]*>\s*\$\s?([\d,]+\.\d{2})/i);
  let listPrice = wasMatch ? toNumber(wasMatch[1]) : null;

  const percentMatch = text.match(/(\d{1,2})\s*%\s*off/i);
  let percentOff = percentMatch ? Number(percentMatch[1]) : null;

  if (!listPrice && percentOff && currentPrice) {
    listPrice = Math.round((currentPrice / (1 - percentOff / 100)) * 100) / 100;
  }

  if (listPrice && !percentOff && currentPrice) {
    percentOff = Math.round(((listPrice - currentPrice) / listPrice) * 1000) / 10;
  }

  if (listPrice && currentPrice && listPrice <= currentPrice) {
    // "Was" price wasn't actually higher than current price - not a real
    // markdown, likely a mismatched regex hit elsewhere on the page.
    listPrice = null;
    percentOff = null;
  }

  return { listPrice, percentOff };
}

export function extractPriceFromHtml(html: string): ExtractedPrice {
  const jsonLd = extractFromJsonLd(html);
  const price = jsonLd.price ?? extractFromMetaTags(html);
  const { listPrice, percentOff } = extractSaleSignal(html, price);

  return {
    price,
    listPrice,
    isSale: listPrice !== null && price !== null && listPrice > price,
    percentOff,
    inStock: jsonLd.inStock,
  };
}
