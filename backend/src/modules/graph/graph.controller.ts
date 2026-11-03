import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { GraphService } from './graph.service';
import { Roles } from '../../common/security/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { AuditService } from '../operations/services/audit.service';
import { Public } from '../../common/security/public.decorator';

@Controller('graph')
export class GraphController {
  constructor(
    private readonly service: GraphService,
    private readonly audit: AuditService,
  ) {}

  @Post('rebuild')
  @Roles(UserRole.SUPER_ADMIN)
  async rebuild(@Req() req: any) {
    const result = await this.service.rebuild();
    await this.audit.record({
      actor: req.user,
      action: 'graph.rebuild_matrix',
      entityType: 'routing_build',
      entityId: (result as any)?.buildId ?? (result as any)?.id ?? null,
      scope: 'system',
      metadata: { status: (result as any)?.status ?? 'completed' },
    });
    return result;
  }

  @Get('destination-matrix')
  @Roles(UserRole.SUPER_ADMIN)
  getDestinationMatrix() {
    return this.service.getDestinationMatrix();
  }

  @Get('destination-distances')
  @Roles(UserRole.SUPER_ADMIN)
  getDestinationDistances() {
    return this.service.getDestinationDistances();
  }

  @Get('road-nodes')
  @Roles(UserRole.SUPER_ADMIN)
  getRoadNodes(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.service.getRoadNodes(Number(page) || 1, Number(limit) || 250);
  }

  @Get('road-edges')
  @Roles(UserRole.SUPER_ADMIN)
  getRoadEdges(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.service.getRoadEdges(Number(page) || 1, Number(limit) || 250);
  }

  @Get('playback')
  @Roles(
    UserRole.ADMIN_OPERASIONAL,
    UserRole.SUPER_ADMIN,
    UserRole.DRIVER,
    UserRole.TOUR_GUIDE,
  )
  getPlaybackGraph(
    @Query('nodeIds') nodeIds?: string,
    @Query('edgeIds') edgeIds?: string,
  ) {
    return this.service.getPlaybackGraph(nodeIds, edgeIds);
  }

  @Get('radius')
  @Public()
  @Roles(
    UserRole.ADMIN_OPERASIONAL,
    UserRole.SUPER_ADMIN,
    UserRole.DRIVER,
    UserRole.TOUR_GUIDE,
    UserRole.CUSTOMER,
  )
  getGraphRadius(
    @Query('latitude') latitude?: string,
    @Query('longitude') longitude?: string,
    @Query('radiusMeters') radiusMeters?: string,
  ) {
    return this.service.getGraphRadius(latitude, longitude, radiusMeters);
  }

  @Get('routing-status')
  @Roles(UserRole.SUPER_ADMIN)
  getRoutingStatus() {
    return this.service.getRoutingStatus();
  }

  @Get('nearest-node/:heritageId')
  @Roles(UserRole.SUPER_ADMIN)
  getNearestNode(@Param('heritageId', ParseIntPipe) heritageId: number) {
    return this.service.getNearestNode(heritageId);
  }
}
