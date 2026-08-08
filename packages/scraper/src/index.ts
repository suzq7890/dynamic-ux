import { prisma } from "@price-tracker/shared";
import { runDailyPriceCheck } from "./run";

runDailyPriceCheck()
  .catch((err) => {
    console.error("Fatal error running daily price check:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
