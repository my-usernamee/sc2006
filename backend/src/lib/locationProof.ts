import crypto from "crypto";
import { env } from "../config/env";
export interface LocationValue {
  locationName: string;
  latitude: number;
  longitude: number;
}
/** A server-authenticated OneMap result; failed lookups cannot become valid form input. */
export function locationProof(v: LocationValue): string {
  return crypto
    .createHmac("sha256", env.jwtSecret)
    .update(JSON.stringify([v.locationName, v.latitude, v.longitude]))
    .digest("hex");
}
export function validLocationProof(
  v: LocationValue & { locationToken: string },
): boolean {
  const a = Buffer.from(locationProof(v));
  const b = Buffer.from(v.locationToken);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
