import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TourPackage } from '../../common/entities/tour-package.entity';
import { PackageRoute } from '../../common/entities/package-route.entity';
import { HeritageSite } from '../../common/entities/heritage-site.entity';
import { TourPackageController } from './tour-package.controller';
import { TourPackageService } from './tour-package.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([TourPackage, PackageRoute, HeritageSite]),
  ],
  controllers: [TourPackageController],
  providers: [TourPackageService],
  exports: [TourPackageService],
})
export class TourPackageModule {}
