/**
 * OneMap proxy routes (REQ-14/15, REQ-32/33).
 * The browser calls these instead of calling OneMap directly, so the OneMap
 * credentials never leave the server.
 */
import { Router } from 'express';
import { z } from 'zod';
import { wrap } from '../middleware/errorHandler';
import { requireAuth } from '../middleware/requireAuth';
import * as oneMap from '../services/onemap.service';

export const oneMapRoutes = Router();

oneMapRoutes.use(requireAuth);

const coordinatesSchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

/** REQ-15 / REQ-33: the user dropped a marker; give back the location name. */
oneMapRoutes.get(
  '/reverse-geocode',
  wrap(async (req, res) => {
    const { lat, lng } = coordinatesSchema.parse(req.query);
    res.json(await oneMap.reverseGeocode(lat, lng));
  }),
);

/** Convenience: search for a place so the map can jump there. */
oneMapRoutes.get(
  '/search',
  wrap(async (req, res) => {
    const q = String(req.query.q ?? '');
    res.json(await oneMap.searchPlaces(q));
  }),
);
