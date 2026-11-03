import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { Roles } from '../../common/security/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { GeoPoint, RoutingService } from './routing.service';

@Controller('routing/legacy')
@UseGuards() // Menggunakan AuthGuard dan RolesGuard global
@Roles(UserRole.SUPER_ADMIN)
export class LegacyRoutingController {
  constructor(private readonly service: RoutingService) {}

  @Post('simple')
  @Roles(UserRole.SUPER_ADMIN)
  async simple(@Body() body: { points: { lat: number; lng: number }[] }) {
    const points = this.toGeoPoints(body.points);
    return this.service.getRoute(points[0], points[1]);
  }

  @Post('optimize')
  async optimize(
    @Body()
    body: {
      points: { lat: number; lng: number }[];
      sourceIndex?: number;
      roundTrip?: boolean;
    },
  ) {
    const points = this.toGeoPoints(body.points);
    const sourceIndex = body.sourceIndex ?? 0;
    return this.service.computeOptimalRoute(
      points.filter((_, index) => index !== sourceIndex),
      points[sourceIndex],
    );
  }

  @Post('distance-matrix')
  async distanceMatrix(
    @Body() body: { points: { lat: number; lng: number }[] },
  ) {
    return this.service.buildDistanceMatrix(this.toGeoPoints(body.points));
  }

  @Post('dijkstra')
  async dijkstra(
    @Body()
    body: {
      points: { lat: number; lng: number }[];
      sourceIndex?: number;
    },
  ) {
    const { points, sourceIndex } = body;
    const geoPoints = this.toGeoPoints(points);
    const matrix = this.service.buildDistanceMatrix(geoPoints);
    const { dist, prev } = this.service.dijkstra(matrix, sourceIndex ?? 0);

    const paths = geoPoints.map((_, idx) => ({
      destination: geoPoints[idx],
      distance: dist[idx],
      path: this.service.reconstructPath(prev, idx).map((i) => geoPoints[i]),
    }));

    return { source: geoPoints[sourceIndex ?? 0], paths };
  }

  private toGeoPoints(points: { lat: number; lng: number }[]): GeoPoint[] {
    return points.map((point, index) => ({
      id: index,
      name: `Point ${index + 1}`,
      lat: point.lat,
      lng: point.lng,
    }));
  }
}
