import 'reflect-metadata';
import { IS_PUBLIC_KEY } from '../../common/security/public.decorator';
import { ROLES_KEY } from '../../common/security/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { GraphController } from '../graph/graph.controller';
import { RoutingController } from './routing.controller';
import { RoutingService } from './routing.service';

describe('routing exposure', () => {
  it('keeps matrix and nearest-node graph endpoints super-admin only', () => {
    for (const handler of [
      GraphController.prototype.getDestinationMatrix,
      GraphController.prototype.getNearestNode,
    ]) {
      expect(Reflect.getMetadata(IS_PUBLIC_KEY, handler)).not.toBe(true);
      expect(Reflect.getMetadata(ROLES_KEY, handler)).toEqual([
        UserRole.SUPER_ADMIN,
      ]);
    }
  });

  it('keeps optimize-v2 admin-only after booking preview removal', () => {
    expect(
      Reflect.getMetadata(
        IS_PUBLIC_KEY,
        RoutingController.prototype.optimizeV2,
      ),
    ).not.toBe(true);
    expect(
      Reflect.getMetadata(ROLES_KEY, RoutingController.prototype.optimizeV2),
    ).toEqual([UserRole.ADMIN_OPERASIONAL, UserRole.SUPER_ADMIN]);
    for (const handler of [
      RoutingController.prototype.simple,
      RoutingController.prototype.optimize,
      RoutingController.prototype.distanceMatrix,
      RoutingController.prototype.dijkstra,
    ]) {
      expect(Reflect.getMetadata(IS_PUBLIC_KEY, handler)).not.toBe(true);
      expect(Reflect.getMetadata(ROLES_KEY, handler)).toEqual([
        UserRole.SUPER_ADMIN,
      ]);
    }
  });

  it('exposes only the limited route preview endpoint publicly', () => {
    expect(
      Reflect.getMetadata(IS_PUBLIC_KEY, RoutingController.prototype.preview),
    ).toBe(true);
    expect(
      Reflect.getMetadata(ROLES_KEY, RoutingController.prototype.preview),
    ).toBeUndefined();
  });

  it('rate-limits optimize-v2 more strictly than general routing', () => {
    expect(
      Reflect.getMetadata(
        'THROTTLER:LIMITdefault',
        RoutingController.prototype.optimizeV2,
      ),
    ).toBe(30);
    expect(
      Reflect.getMetadata(
        'THROTTLER:LIMITdefault',
        RoutingController.prototype.preview,
      ),
    ).toBe(30);
    expect(
      Reflect.getMetadata('THROTTLER:LIMITdefault', RoutingController),
    ).toBe(120);
  });

  it('removes graph internals from the public optimized-route response', async () => {
    const service: any = Object.create(RoutingService.prototype);
    service.optimizeV2 = jest.fn().mockResolvedValue({
      algorithm: 'INTERNAL_TSP',
      activeRoutingBuildId: 'secret-build-id',
      orderedDestinationIds: [1, 2],
      orderedDestinations: [{ id: 1 }, { id: 2 }],
      totalDistanceKm: 2.5,
      totalDurationMinutes: 10,
      evaluatedRoutes: [{ orderedIds: [1, 2], totalDistanceKm: 2.5 }],
      segments: [
        {
          from: { id: 1 },
          to: { id: 2 },
          distanceKm: 2.5,
          pathNodeIds: [100, 101],
          edgeSteps: [['edge-1', true]],
          geojson: { type: 'FeatureCollection', features: [] },
        },
      ],
      geojson: { type: 'FeatureCollection', features: [] },
    });

    const result = await service.optimizeV2Public({ destinationIds: [1, 2] });
    expect(result).not.toHaveProperty('algorithm');
    expect(result).not.toHaveProperty('activeRoutingBuildId');
    expect(result).not.toHaveProperty('evaluatedRoutes');
    expect(result.segments[0]).not.toHaveProperty('pathNodeIds');
    expect(result.segments[0]).not.toHaveProperty('edgeSteps');
  });
});
