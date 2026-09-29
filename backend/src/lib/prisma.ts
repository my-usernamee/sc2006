/** The single shared Prisma client used by every service. */
import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();
