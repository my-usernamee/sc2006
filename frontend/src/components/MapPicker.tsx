/**
 * The OneMap location picker (REQ-14/15 for lost items, REQ-32/33 for found).
 *
 * The user taps the map to drop a pin. The coordinates are sent to our own
 * backend, which asks OneMap for the name of that place and sends it back. The
 * name is shown to the user; the coordinates are what matching actually uses.
 *
 * The map tiles come from OneMap's public tile service and need no
 * credentials, which is why they can be loaded straight in the browser.
 */
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useState } from 'react';
import { MapContainer, Marker, TileLayer, useMapEvents } from 'react-leaflet';
import { mapApi } from '../api';

const ONEMAP_TILES = 'https://www.onemap.gov.sg/maps/tiles/Default/{z}/{x}/{y}.png';
const NTU_CENTRE: [number, number] = [1.3483, 103.6831];

/**
 * The pin is drawn here as inline SVG rather than loaded as an image.
 *
 * Leaflet's built-in marker points at three .png files that a bundler cannot
 * resolve, which is why the default pin shows up as a broken image. Drawing it
 * ourselves fixes that and means the pin needs no network request at all, so
 * it can never fail to load.
 */
const pinIcon = L.divIcon({
  className: '', // Leaflet adds a bordered box by default; we do not want it
  iconSize: [32, 40],
  iconAnchor: [16, 38], // the tip of the pin sits on the exact coordinate
  html: `
    <div class="foundit-pin">
      <svg width="32" height="40" viewBox="0 0 32 40" fill="none">
        <ellipse cx="16" cy="37" rx="5" ry="2" fill="rgba(0,0,0,0.18)"/>
        <path
          d="M16 1.5c-6.9 0-12.5 5.6-12.5 12.5 0 8.7 10.6 19.4 12 20.8a.7.7 0 0 0 1 0c1.4-1.4 12-12.1 12-20.8C28.5 7.1 22.9 1.5 16 1.5Z"
          fill="#007aff" stroke="#ffffff" stroke-width="2.5"/>
        <circle cx="16" cy="14" r="4.5" fill="#ffffff"/>
      </svg>
    </div>`,
});

export interface SelectedLocation {
  locationName: string;
  latitude: number;
  longitude: number;
}

/** Listens for taps on the map and reports the coordinates back. */
function ClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (event) => onPick(event.latlng.lat, event.latlng.lng) });
  return null;
}

export function MapPicker({
  value,
  onChange,
}: {
  value: SelectedLocation | null;
  onChange: (location: SelectedLocation) => void;
}) {
  const [looking, setLooking] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);

  async function handlePick(latitude: number, longitude: number) {
    // Show the pin immediately, then fill in the name when OneMap replies.
    // Waiting for the network before moving the pin would feel unresponsive.
    onChange({
      locationName: value?.locationName ?? '',
      latitude,
      longitude,
    });

    setLooking(true);
    setWarning(null);
    try {
      // REQ-15 / REQ-33: get the location name for the coordinates chosen.
      onChange(await mapApi.reverseGeocode(latitude, longitude));
    } catch (e) {
      // If OneMap is unavailable the user can still continue, because matching
      // only ever needs the latitude and longitude.
      setWarning((e as Error).message);
      onChange({
        locationName: `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
        latitude,
        longitude,
      });
    } finally {
      setLooking(false);
    }
  }

  return (
    <div>
      <div
        className="overflow-hidden"
        style={{ borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-card)' }}
      >
        <MapContainer center={NTU_CENTRE} zoom={16} style={{ height: 260, width: '100%' }}>
          <TileLayer
            url={ONEMAP_TILES}
            attribution='<a href="https://www.onemap.gov.sg/">OneMap</a> &copy; Singapore Land Authority'
            minZoom={11}
            maxZoom={19}
          />
          <ClickHandler onPick={handlePick} />
          {value && (
            <Marker
              key={`${value.latitude},${value.longitude}`} // remount so the pin re-drops
              position={[value.latitude, value.longitude]}
              icon={pinIcon}
            />
          )}
        </MapContainer>
      </div>

      <p className="t-foot mt-2.5 px-0.5">
        {looking ? (
          'Finding this place...'
        ) : value?.locationName ? (
          <>
            <span style={{ color: 'var(--label-2)' }}>Selected&nbsp;</span>
            <span style={{ color: 'var(--label)', fontWeight: 590 }}>{value.locationName}</span>
          </>
        ) : (
          'Tap the map to drop a pin where the item was.'
        )}
      </p>

      {warning && (
        <p className="t-caption mt-1 px-0.5" style={{ color: 'var(--amber)' }}>
          {warning} The coordinates were saved without a place name.
        </p>
      )}
    </div>
  );
}
