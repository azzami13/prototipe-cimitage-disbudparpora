export type EdgeStep = [edgeCode: string, reverseGeometry: boolean];

export interface CachedRoadNode {
  id: number;
  code: string;
  lat: number;
  lng: number;
}

export interface CachedGraphNeighbor {
  toNodeCode: string;
  costM: number;
  edgeCode: string;
  reverseGeometry: boolean;
}

export interface DijkstraParent {
  previousNodeCode: string;
  edgeCode: string;
  reverseGeometry: boolean;
}

export interface DijkstraResult {
  distances: Map<string, number>;
  previous: Map<string, DijkstraParent>;
}

export interface GeoJsonFeatureCollection {
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    geometry: { type: 'LineString'; coordinates: number[][] };
    properties: Record<string, unknown>;
  }>;
}

export const EARTH_RADIUS_M = 6_371_000;

export function haversineM(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const aLat = toRad(lat1);
  const bLat = toRad(lat2);
  const dLat = bLat - aLat;
  const dLng = toRad(lng2 - lng1);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(aLat) * Math.cos(bLat) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}
