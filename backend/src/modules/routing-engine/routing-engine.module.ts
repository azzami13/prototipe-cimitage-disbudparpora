import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DestinationDistance } from '../../common/entities/destination-distance.entity';
import { DestinationNode } from '../../common/entities/destination-node.entity';
import { HeritageSite } from '../../common/entities/heritage-site.entity';
import { RoadEdge } from '../../common/entities/road-edge.entity';
import { RoadNode } from '../../common/entities/road-node.entity';
import { RoutingBuild } from '../../common/entities/routing-build.entity';
import { RoutingGeoJsonService } from './routing-geojson.service';
import { RoutingGraphCacheService } from './routing-graph-cache.service';
import { RoutingMatrixBuilderService } from './routing-matrix-builder.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      RoadNode,
      RoadEdge,
      HeritageSite,
      DestinationNode,
      DestinationDistance,
      RoutingBuild,
    ]),
  ],
  providers: [
    RoutingGraphCacheService,
    RoutingGeoJsonService,
    RoutingMatrixBuilderService,
  ],
  exports: [
    RoutingGraphCacheService,
    RoutingGeoJsonService,
    RoutingMatrixBuilderService,
  ],
})
export class RoutingEngineModule {}
