import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  transactionOptions: {
    maxWait: 10000,  // 10s chờ kết nối
    timeout: 15000,  // 15s timeout cho transaction
  },
});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
