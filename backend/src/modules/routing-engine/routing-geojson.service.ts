import { Injectable } from '@nestjs/common';
import { EdgeStep, GeoJsonFeatureCollection } from './routing-types';
import { RoutingGraphCacheService } from './routing-graph-cache.service';

@Injectable()
export class RoutingGeoJsonService {
  constructor(private readonly graph: RoutingGraphCacheService) {}

  fromEdgeSteps(steps: EdgeStep[]): GeoJsonFeatureCollection {
    return this.graph.edgeStepsToGeoJson(steps);
  }

  merge(collections: Array<GeoJsonFeatureCollection | null | undefined>) {
    return {
      type: 'FeatureCollection' as const,
      features: collections.flatMap((item) => item?.features ?? []),
    };
  }
}
