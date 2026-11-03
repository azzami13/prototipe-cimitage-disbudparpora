import { Controller, Post, Body, Get, Query } from '@nestjs/common';
import { RoutingService, GeoPoint } from './routing.service';
import { Throttle } from '@nestjs/throttler';
import { Roles } from '../../common/security/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { OptimizePublicRouteDto } from './dto/optimize-public-route.dto';
import { Public } from '../../common/security/public.decorator';

@Controller('routing')
@Throttle({ default: { limit: 120, ttl: 60_000 } })
export class RoutingController {
  constructor(private readonly service: RoutingService) {}

  /**
   * @deprecated Endpoint ini digantikan oleh `optimize-v2` yang lebih akurat dan efisien.
   * Dipertahankan hanya untuk backward compatibility internal super_admin.
   * GET /api/routing/simple
   * Rute sederhana A ke B
   */
  @Get('simple')
  @Roles(UserRole.SUPER_ADMIN)
  async simple(
    @Query('fromLat') fromLat: string,
    @Query('fromLng') fromLng: string,
    @Query('toLat') toLat: string,
    @Query('toLng') toLng: string,
  ) {
    const from: GeoPoint = {
      id: 0,
      name: 'Start',
      lat: +fromLat,
      lng: +fromLng,
    };
    const to: GeoPoint = { id: 1, name: 'End', lat: +toLat, lng: +toLng };
    return this.service.getRoute(from, to);
  }

  /**
   * @deprecated Endpoint ini digantikan oleh `optimize-v2`. Menggunakan OSRM/Haversine yang tidak efisien.
   * Dipertahankan hanya untuk backward compatibility internal super_admin.
   * POST /api/routing/optimize
   * Hitung rute optimal multi-destinasi dengan algoritma Dijkstra / Nearest Neighbor
   * Body: { destinations: [{id, name, lat, lng}], userLocation?: {lat, lng} }
   */
  @Post('optimize')
  @Roles(UserRole.SUPER_ADMIN)
  async optimize(
    @Body()
    body: {
      destinations: GeoPoint[];
      userLocation?: { lat: number; lng: number };
    },
  ) {
    const { destinations, userLocation } = body;

    if (!destinations || destinations.length < 2) {
      return { error: 'Minimal 2 destinasi diperlukan' };
    }

    const userPoint: GeoPoint | undefined = userLocation
      ? {
          id: -1,
          name: 'Lokasi Saya',
          lat: userLocation.lat,
          lng: userLocation.lng,
        }
      : undefined;

    return this.service.computeOptimalRoute(destinations, userPoint);
  }

  /**
   * POST /api/routing/optimize-v2
   * Optimasi rute berbasis cost matrix DestinationDistance + TSP.
   */
  @Post('optimize-v2')
  @Roles(UserRole.ADMIN_OPERASIONAL, UserRole.SUPER_ADMIN)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async optimizeV2(@Body() body: OptimizePublicRouteDto) {
    return this.service.optimizeV2(body);
  }

  /**
   * POST /api/routing/preview
   * Preview rute publik dengan output terbatas tanpa metadata graph internal.
   */
  @Post('preview')
  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async preview(@Body() body: OptimizePublicRouteDto) {
    return this.service.optimizeV2Public(body);
  }

  /**
   * @deprecated Endpoint ini menggunakan matriks jarak Haversine yang tidak akurat untuk jalan raya.
   * Dipertahankan hanya untuk backward compatibility internal super_admin.
   * POST /api/routing/distance-matrix
   * Matriks jarak antar semua titik (untuk visualisasi)
   */
  @Post('distance-matrix')
  @Roles(UserRole.SUPER_ADMIN)
  async distanceMatrix(@Body() body: { points: GeoPoint[] }) {
    const matrix = this.service.buildDistanceMatrix(body.points);
    return { points: body.points, matrix };
  }

  /**
   * @deprecated Endpoint ini menjalankan Dijkstra pada matriks Haversine, hasilnya tidak akurat untuk jalan raya.
   * Dipertahankan hanya untuk backward compatibility internal super_admin.
   * POST /api/routing/dijkstra
   * Shortest path dari satu sumber ke semua titik
   */
  @Post('dijkstra')
  @Roles(UserRole.SUPER_ADMIN)
  async dijkstra(@Body() body: { points: GeoPoint[]; sourceIndex: number }) {
    const { points, sourceIndex } = body;
    const matrix = this.service.buildDistanceMatrix(points);
    const { dist, prev } = this.service.dijkstra(matrix, sourceIndex ?? 0);

    // Rekonstruksi semua path
    const paths = points.map((_, idx) => ({
      destination: points[idx],
      distance: dist[idx],
      path: this.service.reconstructPath(prev, idx).map((i) => points[i]),
    }));

    return { source: points[sourceIndex], paths };
  }
}
