import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DestinationDistance } from '../../common/entities/destination-distance.entity';
import { DestinationNode } from '../../common/entities/destination-node.entity';
import { HeritageSite } from '../../common/entities/heritage-site.entity';
import { RoadEdge } from '../../common/entities/road-edge.entity';
import { RoadNode } from '../../common/entities/road-node.entity';
import { OsrmService } from './osrm.service';
import { RoutingController } from './routing.controller';
import { RoutingService } from './routing.service';
import { RoutingBuild } from '../../common/entities/routing-build.entity';
import { RoutingEngineModule } from '../routing-engine/routing-engine.module';
import { DestinationDistanceGeometryRepository } from './destination-distance-geometry.repository';

@Module({
  imports: [
    RoutingEngineModule,
    TypeOrmModule.forFeature([
      HeritageSite,
      RoadNode,
      RoadEdge,
      DestinationNode,
      DestinationDistance,
      RoutingBuild,
    ]),
  ],
  controllers: [RoutingController],
  providers: [
    RoutingService,
    OsrmService,
    DestinationDistanceGeometryRepository,
  ],
  exports: [RoutingService],
})
export class RoutingModule {}
