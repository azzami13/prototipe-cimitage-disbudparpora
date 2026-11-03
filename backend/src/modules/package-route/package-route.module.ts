import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PackageRoute } from '../../common/entities/package-route.entity';
import { TourPackage } from '../../common/entities/tour-package.entity';
import { HeritageSite } from '../../common/entities/heritage-site.entity';
import { PackageRouteController } from './package-route.controller';
import { PackageRouteService } from './package-route.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([PackageRoute, TourPackage, HeritageSite]),
  ],
  controllers: [PackageRouteController],
  providers: [PackageRouteService],
  exports: [PackageRouteService],
})
export class PackageRouteModule {}
