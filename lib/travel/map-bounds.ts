export type MapBounds = {
  north: number;
  south: number;
  east: number;
  west: number;
  northEast: { lat: number; lng: number };
  southWest: { lat: number; lng: number };
};

export type GeoPoint = {
  latitude: number;
  longitude: number;
};

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

function cornerLatLng(value: unknown): { lat: number; lng: number } | null {
  if (!value) return null;
  if (Array.isArray(value) && value.length >= 2) {
    const lat = Number(value[0]);
    const lng = Number(value[1]);
    if (isFiniteNumber(lat) && isFiniteNumber(lng)) return { lat, lng };
    return null;
  }
  if (typeof value === "object") {
    const raw = value as Record<string, unknown>;
    const lat = Number(raw.lat ?? raw.latitude);
    const lng = Number(raw.lng ?? raw.lon ?? raw.longitude);
    if (isFiniteNumber(lat) && isFiniteNumber(lng)) return { lat, lng };
  }
  return null;
}

export function normalizeMapBounds(input: {
  north: number;
  south: number;
  east: number;
  west: number;
}): MapBounds | null {
  const { north, south, east, west } = input;
  if (![north, south, east, west].every(isFiniteNumber)) return null;
  if (north < south) return null;
  if (north > 90 || south < -90) return null;
  if (east > 180 || west < -180 || east < -180 || west > 180) return null;
  return {
    north,
    south,
    east,
    west,
    northEast: { lat: north, lng: east },
    southWest: { lat: south, lng: west },
  };
}

export function parseMapBounds(input: unknown): MapBounds | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;

  const nestedNe = cornerLatLng(raw.northEast ?? raw.northeast ?? raw.ne);
  const nestedSw = cornerLatLng(raw.southWest ?? raw.southwest ?? raw.sw);
  if (nestedNe && nestedSw) {
    return normalizeMapBounds({
      north: nestedNe.lat,
      south: nestedSw.lat,
      east: nestedNe.lng,
      west: nestedSw.lng,
    });
  }

  return normalizeMapBounds({
    north: Number(raw.north),
    south: Number(raw.south),
    east: Number(raw.east),
    west: Number(raw.west),
  });
}

export function pointInBounds(point: GeoPoint, bounds: MapBounds): boolean {
  if (point.latitude > bounds.north || point.latitude < bounds.south) return false;
  if (bounds.west <= bounds.east) {
    return point.longitude >= bounds.west && point.longitude <= bounds.east;
  }
  // Antimeridian-crossing viewport
  return point.longitude >= bounds.west || point.longitude <= bounds.east;
}

export function parseCoordinate(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Distance score used to re-rank hotels nearer the viewport center first. */
export function boundsCenterDistanceKm(point: GeoPoint, bounds: MapBounds): number {
  const centerLat = (bounds.north + bounds.south) / 2;
  const centerLng =
    bounds.west <= bounds.east
      ? (bounds.west + bounds.east) / 2
      : ((((bounds.west + bounds.east + 360) / 2 + 540) % 360) - 180);
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(point.latitude - centerLat);
  const dLng = toRad(point.longitude - centerLng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(centerLat)) * Math.cos(toRad(point.latitude)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
