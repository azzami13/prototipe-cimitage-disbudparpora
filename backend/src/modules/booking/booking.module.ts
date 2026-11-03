import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Booking } from '../../common/entities/booking.entity';
import { TourPackage } from '../../common/entities/tour-package.entity';
import { User } from '../../common/entities/user.entity';
import { RentalOption } from '../../common/entities/rental-option.entity';
import { HeritageSite } from '../../common/entities/heritage-site.entity';
import { Sakoci } from '../../common/entities/sakoci.entity';
import { RouteOptimizationResult } from '../../common/entities/route-optimization-result.entity';
import { DriverTrip } from '../../common/entities/driver-trip.entity';
import { TripIncident } from '../../common/entities/trip-incident.entity';
import { BookingController } from './booking.controller';
import { AdminDashboardController } from './admin-dashboard.controller';
import { BookingService } from './booking.service';
import { BookingGateway } from './booking.gateway';
import { RoutingModule } from '../routing/routing.module';
import { BookingOwnershipGuard } from './booking-ownership.guard';
import { OperationsModule } from '../operations/operations.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Booking,
      TourPackage,
      User,
      RentalOption,
      HeritageSite,
      Sakoci,
      RouteOptimizationResult,
      DriverTrip,
      TripIncident,
    ]),
    RoutingModule,
    OperationsModule,
  ],
  controllers: [BookingController, AdminDashboardController],
  providers: [BookingService, BookingGateway, BookingOwnershipGuard],
  exports: [BookingService],
})
export class BookingModule {}
