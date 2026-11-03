import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DriverTrip } from '../../common/entities/driver-trip.entity';
import { Sakoci } from '../../common/entities/sakoci.entity';
import { SakociController } from './sakoci.controller';
import { SakociService } from './sakoci.service';
import { OperationsModule } from '../operations/operations.module';

@Module({
  imports: [TypeOrmModule.forFeature([Sakoci, DriverTrip]), OperationsModule],
  controllers: [SakociController],
  providers: [SakociService],
  exports: [SakociService],
})
export class SakociModule {}
