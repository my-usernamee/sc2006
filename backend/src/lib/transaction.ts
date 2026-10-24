import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { conflict } from "./errors";
export type Store = Prisma.TransactionClient;
/** Retry serialisation conflicts; every predicate check and write uses the same snapshot. */
export async function atomic<T>(work: (tx: Store) => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await prisma.$transaction(work, {
        isolationLevel: "Serializable",
        maxWait: 10000,
        timeout: 30000,
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        ["P2034", "P2002"].includes(e.code)
      ) {
        if (attempt < 4) continue;
        throw conflict(
          "Another action changed this data. Refresh and try again.",
        );
      }
      throw e;
    }
  }
  throw conflict("Please retry.");
}
