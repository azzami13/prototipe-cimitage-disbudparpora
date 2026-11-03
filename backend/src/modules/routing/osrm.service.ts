import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

export interface OsrmCoordinate {
  latitude: number;
  longitude: number;
}

export interface OsrmRouteGeometryResult {
  distanceKm: number;
  durationMinutes: number;
  geometry: any;
  alternatives: Array<{
    distanceKm: number;
    durationMinutes: number;
    geometry: any;
  }>;
  geojson: {
    type: 'FeatureCollection';
    features: any[];
  };
}

interface OSRMRoute {
  distance: number;
  duration: number;
  geometry: any;
}

interface OSRMResponse {
  routes: OSRMRoute[];
}

@Injectable()
export class OsrmService {
  private readonly logger = new Logger(OsrmService.name);
  private readonly baseUrl = 'https://router.project-osrm.org/route/v1/driving';

  async getRouteGeometry(
    coordinates: OsrmCoordinate[],
  ): Promise<OsrmRouteGeometryResult | null> {
    if (coordinates.length < 2) return null;

    try {
      const coordinateParam = coordinates
        .map((coordinate) => `${coordinate.longitude},${coordinate.latitude}`)
        .join(';');
      const url = `${this.baseUrl}/${coordinateParam}?overview=full&geometries=geojson&steps=true&alternatives=true`;
      const res = await axios.get<OSRMResponse>(url, { timeout: 7000 });
      const [selectedRoute, ...alternativeRoutes] = res.data.routes ?? [];

      if (!selectedRoute) return null;

      const alternatives = alternativeRoutes.map((route) => ({
        distanceKm: Number((route.distance / 1000).toFixed(3)),
        durationMinutes: Number((route.duration / 60).toFixed(2)),
        geometry: route.geometry,
      }));

      return {
        distanceKm: Number((selectedRoute.distance / 1000).toFixed(3)),
        durationMinutes: Number((selectedRoute.duration / 60).toFixed(2)),
        geometry: selectedRoute.geometry,
        alternatives,
        geojson: {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: selectedRoute.geometry,
              properties: {
                source: 'OSRM',
                distanceKm: Number((selectedRoute.distance / 1000).toFixed(3)),
                durationMinutes: Number(
                  (selectedRoute.duration / 60).toFixed(2),
                ),
              },
            },
            ...alternatives.map((alternative, index) => ({
              type: 'Feature',
              geometry: alternative.geometry,
              properties: {
                source: 'OSRM_ALTERNATIVE',
                alternativeIndex: index + 1,
                distanceKm: alternative.distanceKm,
                durationMinutes: alternative.durationMinutes,
              },
            })),
          ],
        },
      };
    } catch (err: any) {
      this.logger.warn(`OSRM geometry failed: ${err.message}`);
      return null;
    }
  }
}
