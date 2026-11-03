import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HeritageSite } from '../../common/entities/heritage-site.entity';
import { PackageRoute } from '../../common/entities/package-route.entity';
import { HeritageController } from './heritage.controller';
import { HeritageService } from './heritage.service';

@Module({
  imports: [TypeOrmModule.forFeature([HeritageSite, PackageRoute])],
  controllers: [HeritageController],
  providers: [HeritageService],
  exports: [HeritageService],
})
export class HeritageModule {}
