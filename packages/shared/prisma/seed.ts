import { PrismaClient, Site } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.item.findFirst({
    where: { modelNumber: "GCFG3070BF" },
  });
  if (existing) {
    console.log("Frigidaire GCFG3070BF item already exists, skipping seed.");
    return;
  }

  const item = await prisma.item.create({
    data: {
      name: "Frigidaire Gallery 30\" Freestanding Gas Range (GCFG3070BF)",
      modelNumber: "GCFG3070BF",
      notes:
        "Premium Gallery-series gas range (not the base Frigidaire model). Confirm the exact fuel type (gas) and finish when setting each site's product URL.",
      sites: {
        create: [Site.LOWES, Site.HOME_DEPOT, Site.BEST_BUY, Site.FRIGIDAIRE].map((site) => ({
          site,
          enabled: true,
          // No productUrl set on purpose: the scraper will attempt a
          // best-effort search using the model number on first run and
          // cache whatever it finds here. For reliability, open the item
          // in the UI and paste the exact product URL for each site.
        })),
      },
    },
    include: { sites: true },
  });

  console.log(`Seeded item ${item.id} (${item.name}) with ${item.sites.length} tracked sites.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
