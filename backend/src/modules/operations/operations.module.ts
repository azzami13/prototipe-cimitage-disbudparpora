import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from '../../common/entities/audit-log.entity';
import { Booking } from '../../common/entities/booking.entity';
import { DriverTrip } from '../../common/entities/driver-trip.entity';
import { RouteOptimizationResult } from '../../common/entities/route-optimization-result.entity';
import { Sakoci } from '../../common/entities/sakoci.entity';
import { SystemSetting } from '../../common/entities/system-setting.entity';
import { TripIncident } from '../../common/entities/trip-incident.entity';
import { User } from '../../common/entities/user.entity';
import { OperationsController } from './operations.controller';
import { AuditService } from './services/audit.service';
import { OperationsService } from './services/operations.service';
import { SettingsService } from './services/settings.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AuditLog,
      Booking,
      DriverTrip,
      RouteOptimizationResult,
      Sakoci,
      SystemSetting,
      TripIncident,
      User,
    ]),
  ],
  controllers: [OperationsController],
  providers: [SettingsService, AuditService, OperationsService],
  exports: [SettingsService, AuditService],
})
export class OperationsModule {}
