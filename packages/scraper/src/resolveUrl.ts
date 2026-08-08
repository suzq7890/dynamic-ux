import { fetchRenderedHtml } from "./browser";
import { SiteAdapter } from "./sites/types";

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function absoluteUrl(href: string, base: string): string | null {
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}

interface Candidate {
  url: string;
  matchesText: boolean;
  matchesPathHint: boolean;
}

function findCandidates(html: string, baseUrl: string, modelNumber: string, pathHint?: RegExp): Candidate[] {
  const needle = normalize(modelNumber);
  const anchorRe = /<a\s+[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  const seen = new Set<string>();
  const candidates: Candidate[] = [];

  let match: RegExpExecArray | null;
  while ((match = anchorRe.exec(html))) {
    const href = match[1];
    const text = match[2].replace(/<[^>]+>/g, " ");
    const absolute = absoluteUrl(href, baseUrl);
    if (!absolute || seen.has(absolute)) continue;

    const matchesText = normalize(text).includes(needle) || normalize(href).includes(needle);
    if (!matchesText) continue;

    seen.add(absolute);
    candidates.push({
      url: absolute,
      matchesText,
      matchesPathHint: pathHint ? pathHint.test(href) : false,
    });
  }

  // Prefer links whose path also looks like a real product-detail page.
  candidates.sort((a, b) => Number(b.matchesPathHint) - Number(a.matchesPathHint));
  return candidates;
}

/**
 * Best-effort resolution of a product URL by searching the site for the
 * model number and picking the first result whose link text or href
 * contains it. This is inherently fragile against sites with heavy
 * bot-protection or client-side-only rendering of search results - a
 * manually pasted productUrl on the ItemSite is always more reliable.
 */
export async function resolveProductUrl(adapter: SiteAdapter, modelNumber: string): Promise<string | null> {
  const searchUrl = adapter.buildSearchUrl(modelNumber);
  const html = await fetchRenderedHtml(searchUrl);
  const candidates = findCandidates(html, adapter.baseUrl, modelNumber, adapter.productPathHint);
  return candidates[0]?.url ?? null;
}
