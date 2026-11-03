import type { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import { Booking } from '../common/entities/booking.entity';
import { AuditLog } from '../common/entities/audit-log.entity';
import { DestinationDistance } from '../common/entities/destination-distance.entity';
import { DestinationNode } from '../common/entities/destination-node.entity';
import { DriverTrip } from '../common/entities/driver-trip.entity';
import { HeritageSite } from '../common/entities/heritage-site.entity';
import { PackageRoute } from '../common/entities/package-route.entity';
import { RentalOption } from '../common/entities/rental-option.entity';
import { RoadEdge } from '../common/entities/road-edge.entity';
import { RoadNode } from '../common/entities/road-node.entity';
import { Role } from '../common/entities/role.entity';
import { RouteOptimizationResult } from '../common/entities/route-optimization-result.entity';
import { RoutingBuild } from '../common/entities/routing-build.entity';
import { Sakoci } from '../common/entities/sakoci.entity';
import { SystemSetting } from '../common/entities/system-setting.entity';
import { TourPackage } from '../common/entities/tour-package.entity';
import { TripGuideSession } from '../common/entities/trip-guide-session.entity';
import { TripIncident } from '../common/entities/trip-incident.entity';
import { TripItineraryItem } from '../common/entities/trip-itinerary-item.entity';
import { TripLocationLog } from '../common/entities/trip-location-log.entity';
import { TripStatusHistory } from '../common/entities/trip-status-history.entity';
import { User } from '../common/entities/user.entity';
import { CreateDriverTripOperations1782028800000 } from './migrations/1782028800000-CreateDriverTripOperations';
import { AddRoutingMatrixCache1782259200000 } from './migrations/1782259200000-AddRoutingMatrixCache';
import { AddTourGuideTripOperations1782345600000 } from './migrations/1782345600000-AddTourGuideTripOperations';
import { AddBookingOperationalPhase2178243200000 } from './migrations/1782432000000-AddBookingOperationalPhase2';
import { AddRouteFinalizationMetadata1782518400000 } from './migrations/1782518400000-AddRouteFinalizationMetadata';
import { AddOperationsSettingsAudit1782604800000 } from './migrations/1782604800000-AddOperationsSettingsAudit';
import { AddPostgisSpatialColumns1782691200000 } from './migrations/1782691200000-AddPostgisSpatialColumns';
import { AddDestinationDistancePathGeometry1782777600000 } from './migrations/1782777600000-AddDestinationDistancePathGeometry';
import { AddDestinationDistancePathEdgeIds1782864000000 } from './migrations/1782864000000-AddDestinationDistancePathEdgeIds';
import { AddRouteSnapshotPlaybackFields1782950400000 } from './migrations/1782950400000-AddRouteSnapshotPlaybackFields';
import { AddSakociImageUrl1783036800000 } from './migrations/1783036800000-AddSakociImageUrl';
import { EnsureCustomerRole1783123200000 } from './migrations/1783123200000-EnsureCustomerRole';

export const databaseEntities = [
  HeritageSite,
  TourPackage,
  PackageRoute,
  Booking,
  AuditLog,
  User,
  Role,
  RentalOption,
  Sakoci,
  SystemSetting,
  RoadNode,
  RoadEdge,
  DestinationNode,
  DestinationDistance,
  RouteOptimizationResult,
  RoutingBuild,
  DriverTrip,
  TripItineraryItem,
  TripStatusHistory,
  TripLocationLog,
  TripIncident,
  TripGuideSession,
];

export const databaseMigrations = [
  CreateDriverTripOperations1782028800000,
  AddRoutingMatrixCache1782259200000,
  AddTourGuideTripOperations1782345600000,
  AddBookingOperationalPhase2178243200000,
  AddRouteFinalizationMetadata1782518400000,
  AddOperationsSettingsAudit1782604800000,
  AddPostgisSpatialColumns1782691200000,
  AddDestinationDistancePathGeometry1782777600000,
  AddDestinationDistancePathEdgeIds1782864000000,
  AddRouteSnapshotPlaybackFields1782950400000,
  AddSakociImageUrl1783036800000,
  EnsureCustomerRole1783123200000,
];

export function getDatabaseOptions(
  env: NodeJS.ProcessEnv = process.env,
): PostgresConnectionOptions {
  const databaseUrl = env.DATABASE_URL?.trim();

  if (!databaseUrl) {
    throw new Error('DATABASE_URL wajib diisi');
  }

  const isProduction = env.NODE_ENV === 'production';

  return {
    type: 'postgres',
    url: databaseUrl,
    entities: databaseEntities,
    migrations: databaseMigrations,
    migrationsTableName: 'migrations',
    migrationsRun: false,
    synchronize:
      !isProduction && env.TYPEORM_SYNCHRONIZE?.toLowerCase() === 'true',
    logging: env.TYPEORM_LOGGING?.toLowerCase() === 'true',
    ssl: isProduction ? { rejectUnauthorized: false } : false,
  };
}
