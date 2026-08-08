import { chromium, Browser, BrowserContext } from "playwright";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

let browserPromise: Promise<Browser> | null = null;

function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = chromium.launch({ headless: true });
  }
  return browserPromise;
}

async function newContext(): Promise<BrowserContext> {
  const browser = await getBrowser();
  return browser.newContext({
    userAgent: USER_AGENT,
    viewport: { width: 1366, height: 900 },
    locale: "en-US",
    extraHTTPHeaders: {
      "Accept-Language": "en-US,en;q=0.9",
    },
  });
}

/**
 * Fetches a URL with a real (headless) browser and returns the rendered
 * HTML. Home Depot / Lowe's / Best Buy all run bot-detection in front of
 * their site, so this is best-effort: some runs may get a challenge page
 * instead of the product page, which will simply fail price extraction and
 * get logged rather than crash the whole run.
 */
export async function fetchRenderedHtml(url: string, opts: { waitForSelector?: string } = {}): Promise<string> {
  const context = await newContext();
  const page = await context.newPage();
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
    if (opts.waitForSelector) {
      await page.waitForSelector(opts.waitForSelector, { timeout: 10_000 }).catch(() => {});
    } else {
      await page.waitForTimeout(2_000);
    }
    return await page.content();
  } finally {
    await context.close();
  }
}

export async function closeBrowser(): Promise<void> {
  if (browserPromise) {
    const browser = await browserPromise;
    await browser.close();
    browserPromise = null;
  }
}
