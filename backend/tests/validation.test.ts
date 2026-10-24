import { describe, it, expect, vi } from "vitest";
vi.hoisted(() => {
  process.env.DATABASE_URL ??= "postgresql://unused/unused";
  process.env.JWT_SECRET ??= "unit-test-signing-secret-not-production";
});
import { lostReportSchema, foundReportSchema } from "../src/validation/schemas";
import { locationProof } from "../src/lib/locationProof";
const location = { locationName: "NTU", latitude: 1.34, longitude: 103.68 };
const base = {
  ...location,
  locationToken: locationProof(location),
  itemName: "Bag",
  category: "BAGS",
  colour: "BLACK",
  brand: "Nike",
  brandUnknown: "false",
  dateLost: "2026-09-01",
  notificationThreshold: "60",
};
describe("SRS validation boundaries", () => {
  it.each(["0", "100"])("accepts threshold %s", (v) =>
    expect(
      lostReportSchema.safeParse({ ...base, notificationThreshold: v }).success,
    ).toBe(true),
  );
  it.each(["", "-1", "101", "0.5", "not-a-number"])(
    "rejects threshold %s",
    (v) =>
      expect(
        lostReportSchema.safeParse({ ...base, notificationThreshold: v })
          .success,
      ).toBe(false),
  );
  it.each(["2026-02-30", "2026-13-01", "2099-01-01"])(
    "rejects invalid/future date %s",
    (v) =>
      expect(lostReportSchema.safeParse({ ...base, dateLost: v }).success).toBe(
        false,
      ),
  );
  it("excludes typed Unknown from brand matching", () =>
    expect(
      lostReportSchema.parse({ ...base, brand: " Unknown " }).brand,
    ).toBeNull());
  it("rejects a blank required brand unless Unknown is selected", () => {
    expect(lostReportSchema.safeParse({ ...base, brand: "" }).success).toBe(
      false,
    );
    expect(
      lostReportSchema.parse({ ...base, brand: "", brandUnknown: "true" })
        .brand,
    ).toBeNull();
  });
  it("rejects edited coordinates with an old location token", () =>
    expect(lostReportSchema.safeParse({ ...base, latitude: 1.5 }).success).toBe(
      false,
    ));
});
