import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DestinationDistance } from '../../common/entities/destination-distance.entity';

@Injectable()
export class DestinationDistanceGeometryRepository {
  constructor(private readonly dataSource: DataSource) {}

  async getRouteGeojsonByDistanceId(rows: DestinationDistance[]) {
    const ids = rows.map((row) => row.id).filter((id) => Number.isInteger(id));
    const geojsonById = new Map<number, any>();

    if (ids.length) {
      const geometryRows: Array<{ id: number; geometry: string | null }> =
        await this.dataSource.query(
          `
            SELECT "id", ST_AsGeoJSON("path_geometry") AS "geometry"
            FROM "destination_distance"
            WHERE "id" = ANY($1)
              AND "path_geometry" IS NOT NULL
          `,
          [ids],
        );

      for (const geometryRow of geometryRows) {
        const geometry = this.parseGeometry(geometryRow.geometry);
        if (!geometry) continue;
        const row = rows.find((item) => item.id === Number(geometryRow.id));
        geojsonById.set(
          Number(geometryRow.id),
          this.toFeatureCollection(geometry, row),
        );
      }
    }

    for (const row of rows) {
      if (!geojsonById.has(row.id) && row.path_geojson) {
        geojsonById.set(row.id, row.path_geojson);
      }
    }

    return geojsonById;
  }

  private parseGeometry(value: string | null) {
    if (!value) return null;
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }

  private toFeatureCollection(geometry: any, row?: DestinationDistance) {
    const cachedFeature = row?.path_geojson?.features?.[0];
    return {
      type: 'FeatureCollection' as const,
      features: [
        {
          type: 'Feature' as const,
          geometry,
          properties: cachedFeature?.properties ?? {
            source: 'POSTGIS_PATH_GEOMETRY',
          },
        },
      ],
    };
  }
}
