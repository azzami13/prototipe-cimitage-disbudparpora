import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DestinationDistance } from '../../common/entities/destination-distance.entity';
import { DestinationNode } from '../../common/entities/destination-node.entity';
import { HeritageSite } from '../../common/entities/heritage-site.entity';
import { RoadEdge } from '../../common/entities/road-edge.entity';
import { RoadNode } from '../../common/entities/road-node.entity';
import { GraphController } from './graph.controller';
import { GraphService } from './graph.service';
import { RoutingBuild } from '../../common/entities/routing-build.entity';
import { RoutingEngineModule } from '../routing-engine/routing-engine.module';
import { OperationsModule } from '../operations/operations.module';

@Module({
  imports: [
    RoutingEngineModule,
    OperationsModule,
    TypeOrmModule.forFeature([
      HeritageSite,
      RoadNode,
      RoadEdge,
      DestinationNode,
      DestinationDistance,
      RoutingBuild,
    ]),
  ],
  controllers: [GraphController],
  providers: [GraphService],
  exports: [GraphService],
})
export class GraphModule {}
