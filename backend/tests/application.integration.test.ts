/** Run only on an isolated foundit_test database; this suite resets its application tables. */
import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import request from "supertest";
import sharp from "sharp";
vi.hoisted(() => {
  if (process.env.TEST_DATABASE_URL)
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  process.env.JWT_SECRET ??= "test-secret-not-for-production-123456789";
  process.env.ONEMAP_TOKEN = "fixture-token";
});
let app: any,
  db: any,
  alice: any,
  bob: any,
  eve: any,
  png: Buffer,
  proof: any,
  rematch: any;
const h = { "X-Requested-With": "FoundIt" },
  loc = { locationName: "NTU", latitude: 1.34639, longitude: 103.68194 };
let seq = 0;
function data(kind = "lost", extra: any = {}) {
  return {
    itemName: "Item " + ++seq,
    category: "BAGS",
    colour: "BLACK",
    brand: "Nike",
    brandUnknown: "false",
    [kind === "lost" ? "dateLost" : "dateFound"]: "2026-09-01",
    ...loc,
    locationToken: proof(loc),
    ...(kind === "lost" ? { notificationThreshold: "60" } : {}),
    ...extra,
  };
}
async function create(
  a: any,
  kind = "lost",
  extra: any = {},
  photo = kind === "found",
) {
  let r = a.post(`/api/${kind}-reports`).set(h);
  for (const [k, v] of Object.entries(data(kind, extra)))
    r = r.field(k, String(v));
  if (photo) r = r.attach("photo", png, "item.png");
  return r;
}
async function edit(a: any, id: string, kind = "lost", extra: any = {}) {
  let r = a.put(`/api/${kind}-reports/${id}`).set(h);
  for (const [k, v] of Object.entries(data(kind, extra)))
    r = r.field(k, String(v));
  return r;
}
async function pair() {
  const l = await create(alice),
    f = await create(bob, "found");
  expect(l.status).toBe(201);
  expect(f.status).toBe(201);
  return { l: l.body, f: f.body };
}
const submit = (l: any, f: any) =>
  alice
    .post("/api/claims")
    .set(h)
    .send({ lostReportId: l.id, foundReportId: f.id });
const decide = (id: string, action: string, a = bob) =>
  a.post(`/api/claims/${id}/${action}`).set(h);
describe.skipIf(process.env.RUN_INTEGRATION !== "1")(
  "SRS API / database regression",
  () => {
    beforeAll(async () => {
      if (
        !new URL(process.env.DATABASE_URL ?? "").pathname.includes(
          "foundit_test",
        )
      )
        throw Error("Use a disposable database named foundit_test.");
      app = (await import("../src/app")).createApp();
      db = (await import("../src/lib/prisma")).prisma;
      proof = (await import("../src/lib/locationProof")).locationProof;
      rematch = (await import("../src/services/matching.service"))
        .matchLostReport;
      await db.$executeRawUnsafe(
        'TRUNCATE "Session", "Notification", "OwnershipClaim", "MatchResult", "LostItemReport", "FoundItemReport", "User" CASCADE',
      );
      png = await sharp({
        create: { width: 8, height: 8, channels: 3, background: "#123456" },
      })
        .png()
        .toBuffer();
      alice = request.agent(app);
      bob = request.agent(app);
      eve = request.agent(app);
      for (const [i, a] of [alice, bob, eve].entries()) {
        const r = await a
          .post("/api/auth/register")
          .set(h)
          .send({
            email: `audit${i}@e.ntu.edu.sg`,
            password: "password123",
            displayName: "User " + i,
            telegramUsername: "@user" + i,
          });
        expect(r.status).toBe(201);
        expect(r.body.token).toBeUndefined();
      }
    }, 30000);
    afterAll(async () => {
      vi.unstubAllGlobals();
      await db?.$disconnect();
    });
    it("requires authentication for reports, claims, alerts, account and photos", async () => {
      for (const p of [
        "/api/lost-reports/mine",
        "/api/found-reports",
        "/api/claims/incoming",
        "/api/notifications",
        "/api/users/me",
        "/uploads/missing.webp",
      ])
        expect((await request(app).get(p)).status).toBe(401);
    });
    it("validates registration, duplicates and incorrect credentials", async () => {
      const input = {
        email: "x@example.com",
        password: "password123",
        displayName: "X",
        telegramUsername: "@x",
      };
      expect(
        (await request(app).post("/api/auth/register").set(h).send(input))
          .status,
      ).toBe(400);
      expect(
        (
          await request(app)
            .post("/api/auth/register")
            .set(h)
            .send({ ...input, email: "audit0@e.ntu.edu.sg" })
        ).status,
      ).toBe(409);
      expect(
        (
          await request(app)
            .post("/api/auth/login")
            .set(h)
            .send({ email: "audit0@e.ntu.edu.sg", password: "wrong" })
        ).status,
      ).toBe(401);
    });
    it("updates own account without exposing password hashes", async () => {
      const r = await alice
        .patch("/api/users/me")
        .set(h)
        .send({ displayName: "Alice", telegramUsername: "@alice" });
      expect(r.status).toBe(200);
      expect(r.body.passwordHash).toBeUndefined();
      expect((await alice.get("/api/auth/me")).body.displayName).toBe("Alice");
    });
    it("rejects cross-origin and form writes", async () => {
      expect((await alice.post("/api/claims").send({})).status).toBe(403);
      expect(
        (
          await alice
            .post("/api/claims")
            .set(h)
            .set("Origin", "https://other.example")
            .send({})
        ).status,
      ).toBe(403);
    });
    it("allows optional lost photo and requires found photo", async () => {
      expect((await create(alice)).status).toBe(201);
      expect((await create(bob, "found", {}, false)).status).toBe(400);
    });
    it("decodes actual image bytes instead of trusting MIME", async () => {
      let r = bob.post("/api/found-reports").set(h);
      for (const [k, v] of Object.entries(data("found")))
        r = r.field(k, String(v));
      expect(
        (
          await r.attach("photo", Buffer.from("not an image"), {
            filename: "fake.png",
            contentType: "image/png",
          })
        ).status,
      ).toBe(400);
    });
    it("rejects empty/range-invalid numbers, impossible dates and invalid OneMap results", async () => {
      for (const extra of [
        { locationToken: "" },
        { latitude: "" },
        { longitude: "" },
        { notificationThreshold: "" },
        { notificationThreshold: "101" },
        { notificationThreshold: "-1" },
        { dateLost: "2026-02-30" },
      ])
        expect((await create(alice, "lost", extra)).status).toBe(400);
    });
    it("checks report ownership and filters private browse data", async () => {
      const l = await create(alice),
        f = await create(bob, "found", { privateDescription: "finder-secret" });
      expect((await edit(eve, l.body.id)).status).toBe(403);
      expect((await eve.get("/api/lost-reports/" + l.body.id)).status).toBe(
        403,
      );
      const r = await alice.get("/api/found-reports/" + f.body.id);
      expect(r.body.privateDescription).toBeUndefined();
      expect(r.body.telegramUsername).toBeUndefined();
      expect(r.body.canEdit).toBe(false);
    });
    it("combines item-name, colour and category filters", async () => {
      await create(bob, "found", {
        itemName: "Unique umbrella",
        category: "UMBRELLAS",
        colour: "BLUE",
      });
      const r = await alice.get(
        "/api/found-reports?q=Unique%20umbrella&category=UMBRELLAS&colour=BLUE",
      );
      expect(r.body.reports).toHaveLength(1);
      expect(r.body.reports[0].status).toBe("OPEN");
    });
    it("returns recipient-scoped match context with score", async () => {
      const { l, f } = await pair();
      const rows = await alice.get(`/api/lost-reports/${l.id}/matches`);
      const m = rows.body.find((x: any) => x.foundReport.id === f.id);
      expect(m.matchScore).toBe(100);
      const p = `/api/lost-reports/${l.id}/matches/${m.id}`;
      expect((await alice.get(p)).body.available).toBe(true);
      expect((await eve.get(p)).status).toBe(403);
    });
    it("deduplicates notifications under concurrent matching", async () => {
      const { l } = await pair();
      await Promise.all([rematch(l.id), rematch(l.id), rematch(l.id)]);
      const rows = await db.notification.findMany({
        where: { matchResult: { lostReportId: l.id } },
      });
      expect(new Set(rows.map((n: any) => n.matchResultId)).size).toBe(
        rows.length,
      );
    });
    it("distinguishes rejected zero from eligible rounded zero at threshold zero", async () => {
      const l = await create(alice, "lost", {
          dateLost: "2026-09-02",
          notificationThreshold: "0",
        }),
        f = await create(bob, "found", { dateFound: "2026-09-01" });
      const get = (l: string, f: string) =>
        db.matchResult.findUnique({
          where: {
            lostReportId_foundReportId: { lostReportId: l, foundReportId: f },
          },
        });
      const rejected = await get(l.body.id, f.body.id);
      expect(rejected.eligible).toBe(false);
      expect(
        await db.notification.count({ where: { matchResultId: rejected.id } }),
      ).toBe(0);
      const old = await create(alice, "lost", {
        dateLost: "2020-01-01",
        notificationThreshold: "0",
        colour: "GREEN",
        brand: "Different",
      });
      const far = { locationName: "Far point", latitude: 1.5, longitude: 110 };
      const farReport = await create(bob, "found", {
        ...far,
        locationToken: proof(far),
      });
      const zero = await get(old.body.id, farReport.body.id);
      expect(zero.matchScore).toBe(0);
      expect(zero.eligible).toBe(true);
      expect(
        await db.notification.count({ where: { matchResultId: zero.id } }),
      ).toBe(1);
    });
    it("locks both Pending reports and notifies Finder", async () => {
      const { l, f } = await pair();
      const c = await submit(l, f);
      expect(c.status).toBe(201);
      expect((await alice.get("/api/lost-reports/" + l.id)).body.locked).toBe(
        true,
      );
      expect((await bob.get("/api/found-reports/" + f.id)).body.canEdit).toBe(
        false,
      );
      expect((await edit(alice, l.id)).status).toBe(409);
      expect(
        (await bob.delete("/api/found-reports/" + f.id).set(h)).status,
      ).toBe(409);
      expect(
        (await bob.get("/api/notifications")).body.some(
          (n: any) => n.claimId === c.body.id && n.type === "CLAIM_SUBMITTED",
        ),
      ).toBe(true);
    });
    it("restricts claim review, private descriptions and contacts", async () => {
      const l = await create(alice, "lost", { privateDescription: "L-secret" }),
        f = await create(bob, "found", { privateDescription: "F-secret" });
      const c = await submit(l.body, f.body);
      const review = await bob.get("/api/claims/" + c.body.id);
      expect(review.body.canReview).toBe(true);
      expect(review.body.lostReport.privateDescription).toBe("L-secret");
      expect(review.body.finder.telegramUsername).toBeUndefined();
      const own = await alice.get("/api/claims/" + c.body.id);
      expect(own.body.canReview).toBe(false);
      expect(own.body.foundReport.privateDescription).toBeUndefined();
      expect((await eve.get("/api/claims/" + c.body.id)).status).toBe(403);
      expect((await decide(c.body.id, "approve", alice)).status).toBe(403);
    });
    it("unlocks after rejection and permits deletion while retaining claim history", async () => {
      const { l, f } = await pair();
      const c = await submit(l, f);
      expect((await decide(c.body.id, "reject")).status).toBe(200);
      expect(
        (await alice.get("/api/lost-reports/" + l.id)).body.canDelete,
      ).toBe(true);
      expect(
        (await alice.delete("/api/lost-reports/" + l.id).set(h)).status,
      ).toBe(200);
      expect((await alice.get("/api/lost-reports/" + l.id)).status).toBe(404);
      expect((await alice.get("/api/claims/" + c.body.id)).body.status).toBe(
        "REJECTED",
      );
      expect(
        (await bob.delete("/api/found-reports/" + f.id).set(h)).status,
      ).toBe(200);
    });
    it("approves, closes both reports, reveals contacts and notifies claimant", async () => {
      const { l, f } = await pair();
      const c = await submit(l, f);
      const r = await decide(c.body.id, "approve");
      expect(r.status).toBe(200);
      expect(r.body.claimant.telegramUsername).toBe("@alice");
      expect(r.body.finder.telegramUsername).toBe("@user1");
      expect((await alice.get("/api/lost-reports/" + l.id)).body.status).toBe(
        "RESOLVED",
      );
      expect((await bob.get("/api/found-reports/" + f.id)).body.status).toBe(
        "CLOSED",
      );
      expect((await decide(c.body.id, "reject")).status).toBe(409);
      expect(
        (await alice.get("/api/notifications")).body.some(
          (n: any) => n.claimId === c.body.id && n.type === "CLAIM_APPROVED",
        ),
      ).toBe(true);
    });
    it("does not re-notify a closed found report on threshold change", async () => {
      const l1 = await create(alice, "lost", { notificationThreshold: "100" }),
        l2 = await create(alice),
        f = await create(bob, "found", { colour: "WHITE" });
      const c = await submit(l2.body, f.body);
      await decide(c.body.id, "approve");
      expect(
        (await edit(alice, l1.body.id, "lost", { notificationThreshold: "0" }))
          .status,
      ).toBe(200);
      const m = await db.matchResult.findUnique({
        where: {
          lostReportId_foundReportId: {
            lostReportId: l1.body.id,
            foundReportId: f.body.id,
          },
        },
      });
      expect(
        await db.notification.count({ where: { matchResultId: m.id } }),
      ).toBe(0);
    });
    it("allows only one simultaneous Pending claim", async () => {
      const { l, f } = await pair();
      const rs = await Promise.all([submit(l, f), submit(l, f)]);
      expect(rs.map((r) => r.status).sort()).toEqual([201, 409]);
    });
    it("allows only one simultaneous approve/reject decision", async () => {
      const { l, f } = await pair();
      const c = await submit(l, f);
      const rs = await Promise.all([
        decide(c.body.id, "approve"),
        decide(c.body.id, "reject"),
      ]);
      expect(rs.map((r) => r.status).sort()).toEqual([200, 409]);
      const state = await db.ownershipClaim.findUnique({
        where: { id: c.body.id },
      });
      const lost = await db.lostItemReport.findUnique({ where: { id: l.id } });
      expect(lost.status).toBe(
        state.status === "APPROVED" ? "RESOLVED" : "ACTIVE",
      );
      expect(
        await db.notification.count({
          where: {
            claimId: c.body.id,
            type: { in: ["CLAIM_APPROVED", "CLAIM_REJECTED"] },
          },
        }),
      ).toBe(1);
    });
    it("handles OneMap success, outage and unnamed locations", async () => {
      vi.stubGlobal(
        "fetch",
        vi
          .fn()
          .mockResolvedValue(
            new Response(
              '{"GeocodeInfo":[{"BUILDINGNAME":"NTU","ROAD":"NANYANG AVENUE"}]}',
              { status: 200 },
            ),
          ),
      );
      const r = await alice.get(
        "/api/onemap/reverse-geocode?lat=1.34&lng=103.68",
      );
      expect(r.status).toBe(200);
      expect(r.body.locationToken).toBeTruthy();
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(new Response("{}", { status: 503 })),
      );
      expect(
        (await alice.get("/api/onemap/reverse-geocode?lat=1.34&lng=103.68"))
          .status,
      ).toBe(502);
      vi.stubGlobal(
        "fetch",
        vi
          .fn()
          .mockResolvedValue(
            new Response('{"GeocodeInfo":[]}', { status: 200 }),
          ),
      );
      expect(
        (await alice.get("/api/onemap/reverse-geocode?lat=1.34&lng=103.68"))
          .status,
      ).toBe(422);
      vi.unstubAllGlobals();
    });
    it("rejects missing claims and unavailable reports before deciding", async () => {
      expect((await decide("missing-claim", "approve")).status).toBe(404);
      const { l, f } = await pair(),
        c = await submit(l, f);
      await db.foundItemReport.update({
        where: { id: f.id },
        data: { status: "CLOSED" },
      });
      expect((await decide(c.body.id, "approve")).status).toBe(409);
      expect(
        (await db.ownershipClaim.findUnique({ where: { id: c.body.id } }))
          .status,
      ).toBe("PENDING");
      await db.foundItemReport.update({
        where: { id: f.id },
        data: { status: "OPEN" },
      });
      await decide(c.body.id, "reject");
    });
    it("rolls back claim creation when its notification cannot be stored", async () => {
      const { l, f } = await pair();
      const realTransaction = db.$transaction.bind(db);
      const fault = vi
        .spyOn(db, "$transaction")
        .mockImplementationOnce((work: any, options: any) =>
          realTransaction(
            (tx: any) =>
              work(
                new Proxy(tx, {
                  get(target, key) {
                    if (key === "notification")
                      return new Proxy(target.notification, {
                        get(delegate, method) {
                          if (method === "create")
                            return () => {
                              throw new Error(
                                "Injected notification storage failure",
                              );
                            };
                          return delegate[method];
                        },
                      });
                    return target[key];
                  },
                }),
              ),
            options,
          ),
        );
      try {
        expect((await submit(l, f)).status).toBe(500);
        expect(
          await db.ownershipClaim.count({
            where: { lostReportId: l.id, foundReportId: f.id },
          }),
        ).toBe(0);
        expect((await alice.get("/api/lost-reports/" + l.id)).body.locked).toBe(
          false,
        );
      } finally {
        fault.mockRestore();
      }
    });
    it("restricts lost photos to their owner and the claim Finder", async () => {
      const l = await create(alice, "lost", {}, true),
        f = await create(bob, "found");
      const url = l.body.photoUrl;
      expect((await alice.get(url)).status).toBe(200);
      expect((await bob.get(url)).status).toBe(404);
      await submit(l.body, f.body);
      expect((await bob.get(url)).status).toBe(200);
      expect((await eve.get(url)).status).toBe(404);
    });
    it("records prototype matching and search timings over 100 additional Open reports", async () => {
      const finder = await db.user.findUnique({
        where: { email: "audit1@e.ntu.edu.sg" },
      });
      const photo = (await db.foundItemReport.findFirst()).photoPath;
      await db.foundItemReport.createMany({
        data: Array.from({ length: 100 }, (_, i) => ({
          userId: finder.id,
          itemName: "Performance fixture " + i,
          category: "BAGS",
          colour: "BLACK",
          brand: "Nike",
          dateFound: new Date("2026-09-01"),
          ...loc,
          photoPath: photo,
        })),
      });
      const start = performance.now();
      const l = await create(alice);
      expect(l.status).toBe(201);
      const matchingMs = Math.round(performance.now() - start);
      expect(
        await db.matchResult.count({ where: { lostReportId: l.body.id } }),
      ).toBeGreaterThanOrEqual(100);
      const searchStart = performance.now();
      expect(
        (await alice.get("/api/found-reports?q=Performance&category=BAGS"))
          .status,
      ).toBe(200);
      const searchMs = Math.round(performance.now() - searchStart);
      console.log(
        JSON.stringify({
          prototypeTiming: {
            additionalFoundReports: 100,
            createAndMatchMs: matchingMs,
            searchMs,
          },
        }),
      );
    }, 15000);
    it("revokes copied cookies on logout", async () => {
      const r = await request(app)
        .post("/api/auth/login")
        .set(h)
        .send({ email: "audit0@e.ntu.edu.sg", password: "password123" });
      const cookie = r.headers["set-cookie"][0].split(";")[0];
      expect(
        (
          await request(app)
            .post("/api/auth/logout")
            .set(h)
            .set("Cookie", cookie)
        ).status,
      ).toBe(200);
      expect(
        (await request(app).get("/api/auth/me").set("Cookie", cookie)).status,
      ).toBe(401);
    });
  },
);
