import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';

// config & database
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { getDatabaseOptions } from './database/database.config';

// feature modules
import { HeritageModule } from './modules/heritage/heritage.module';
import { TourPackageModule } from './modules/tour-package/tour-package.module';
import { PackageRouteModule } from './modules/package-route/package-route.module';
import { BookingModule } from './modules/booking/booking.module';
import { RoutingModule } from './modules/routing/routing.module';
import { AuthModule } from './modules/auth/auth.module';
import { RentalOptionModule } from './modules/rental-option/rental-option.module';
import { AdminUsersModule } from './modules/admin-users/admin-users.module';
import { SakociModule } from './modules/sakoci/sakoci.module';
import { GraphModule } from './modules/graph/graph.module';
import { DriverTripModule } from './modules/driver-trip/driver-trip.module';
import { OperationsModule } from './modules/operations/operations.module';
import { SecurityModule } from './common/security/security.module';
import { StorageModule } from './common/storage/storage.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    TypeOrmModule.forRootAsync({
      useFactory: () => getDatabaseOptions(),
    }),

    SecurityModule,
    StorageModule,

    HeritageModule,
    TourPackageModule,
    PackageRouteModule,
    BookingModule,
    RoutingModule,
    AuthModule,
    RentalOptionModule,
    AdminUsersModule,
    SakociModule,
    GraphModule,
    OperationsModule,
    DriverTripModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
