import { PrismaClient } from "@prisma/client";

// Reuse a single client across hot-reloads / repeated invocations in the
// same process instead of opening a new pool every time this module loads.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
