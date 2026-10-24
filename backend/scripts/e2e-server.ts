/** Test-only OneMap fixture. Never use this server for a live demo or production. */
import { createApp } from "../src/app";
import { prisma } from "../src/lib/prisma";
if (
  process.env.NODE_ENV !== "test" ||
  !new URL(process.env.DATABASE_URL ?? "").pathname.includes("foundit_test")
)
  throw Error(
    "E2E fixture requires NODE_ENV=test and a disposable foundit_test database.",
  );
globalThis.fetch = async () =>
  new Response(
    JSON.stringify({
      GeocodeInfo: [{ BUILDINGNAME: "NTU", ROAD: "NANYANG AVENUE" }],
    }),
    { status: 200 },
  );
prisma
  .$connect()
  .then(() =>
    createApp().listen(3000, "127.0.0.1", () => console.log("E2E ready")),
  );
