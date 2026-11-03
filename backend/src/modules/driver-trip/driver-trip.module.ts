import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DriverTrip } from '../../common/entities/driver-trip.entity';
import { TripItineraryItem } from '../../common/entities/trip-itinerary-item.entity';
import { TripStatusHistory } from '../../common/entities/trip-status-history.entity';
import { TripLocationLog } from '../../common/entities/trip-location-log.entity';
import { TripIncident } from '../../common/entities/trip-incident.entity';
import { TripGuideSession } from '../../common/entities/trip-guide-session.entity';
import { Booking } from '../../common/entities/booking.entity';
import { User } from '../../common/entities/user.entity';
import { Sakoci } from '../../common/entities/sakoci.entity';
import { HeritageSite } from '../../common/entities/heritage-site.entity';
import { RouteOptimizationResult } from '../../common/entities/route-optimization-result.entity';
import { DriverTripController } from './driver-trip.controller';
import { DriverTripService } from './driver-trip.service';
import { DriverTripGateway } from './driver-trip.gateway';
import { OperationsModule } from '../operations/operations.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DriverTrip,
      TripItineraryItem,
      TripStatusHistory,
      TripLocationLog,
      TripIncident,
      TripGuideSession,
      Booking,
      User,
      Sakoci,
      HeritageSite,
      RouteOptimizationResult,
    ]),
    OperationsModule,
  ],
  controllers: [DriverTripController],
  providers: [DriverTripService, DriverTripGateway],
  exports: [DriverTripService, DriverTripGateway],
})
export class DriverTripModule {}
