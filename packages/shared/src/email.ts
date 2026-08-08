import nodemailer, { Transporter } from "nodemailer";

export interface EmailConfig {
  gmailUser: string;
  gmailAppPassword: string;
  toAddress: string;
}

export function loadEmailConfigFromEnv(): EmailConfig | null {
  const gmailUser = process.env.GMAIL_USER;
  const gmailAppPassword = process.env.GMAIL_APP_PASSWORD;
  const toAddress = process.env.ALERT_EMAIL_TO ?? gmailUser;
  if (!gmailUser || !gmailAppPassword || !toAddress) return null;
  return { gmailUser, gmailAppPassword, toAddress };
}

let cachedTransport: Transporter | null = null;

function getTransport(config: EmailConfig): Transporter {
  if (cachedTransport) return cachedTransport;
  cachedTransport = nodemailer.createTransport({
    service: "gmail",
    auth: { user: config.gmailUser, pass: config.gmailAppPassword },
  });
  return cachedTransport;
}

export const SITE_LABELS: Record<string, string> = {
  LOWES: "Lowe's",
  HOME_DEPOT: "Home Depot",
  BEST_BUY: "Best Buy",
  FRIGIDAIRE: "Frigidaire",
};

export interface SaleEmailInput {
  itemName: string;
  modelNumber: string;
  site: string;
  price: number;
  listPrice: number;
  percentOff: number;
  productUrl: string;
}

export async function sendSaleAlertEmail(config: EmailConfig, input: SaleEmailInput): Promise<void> {
  const siteLabel = SITE_LABELS[input.site] ?? input.site;
  const subject = `Sale: ${input.itemName} is ${input.percentOff}% off at ${siteLabel}`;
  const text = [
    `${input.itemName} (Model ${input.modelNumber}) is on sale at ${siteLabel}.`,
    ``,
    `Sale price: $${input.price.toFixed(2)}`,
    `Regular price: $${input.listPrice.toFixed(2)}`,
    `Percent off: ${input.percentOff}%`,
    ``,
    `Link: ${input.productUrl}`,
  ].join("\n");
  const html = `
    <p><strong>${escapeHtml(input.itemName)}</strong> (Model ${escapeHtml(input.modelNumber)}) is on sale at <strong>${escapeHtml(siteLabel)}</strong>.</p>
    <table cellpadding="4">
      <tr><td>Sale price</td><td><strong>$${input.price.toFixed(2)}</strong></td></tr>
      <tr><td>Regular price</td><td>$${input.listPrice.toFixed(2)}</td></tr>
      <tr><td>Percent off</td><td>${input.percentOff}%</td></tr>
    </table>
    <p><a href="${escapeHtml(input.productUrl)}">View at ${escapeHtml(siteLabel)}</a></p>
  `;

  await getTransport(config).sendMail({
    from: config.gmailUser,
    to: config.toAddress,
    subject,
    text,
    html,
  });
}

export interface TrendEmailInput {
  itemName: string;
  modelNumber: string;
  site: string;
  trendType: "RISING" | "FALLING" | "VOLATILE";
  description: string;
  productUrl: string | null;
}

export async function sendTrendAlertEmail(config: EmailConfig, input: TrendEmailInput): Promise<void> {
  const siteLabel = SITE_LABELS[input.site] ?? input.site;
  const subject = `Price trend (${input.trendType.toLowerCase()}): ${input.itemName} at ${siteLabel}`;
  const text = [
    `${input.itemName} (Model ${input.modelNumber}) at ${siteLabel}: ${input.description}`,
    input.productUrl ? `\nLink: ${input.productUrl}` : "",
  ].join("\n");
  const html = `
    <p><strong>${escapeHtml(input.itemName)}</strong> (Model ${escapeHtml(input.modelNumber)}) at <strong>${escapeHtml(siteLabel)}</strong>:</p>
    <p>${escapeHtml(input.description)}</p>
    ${input.productUrl ? `<p><a href="${escapeHtml(input.productUrl)}">View at ${escapeHtml(siteLabel)}</a></p>` : ""}
  `;

  await getTransport(config).sendMail({
    from: config.gmailUser,
    to: config.toAddress,
    subject,
    text,
    html,
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
