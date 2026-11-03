import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RentalOption } from '../../common/entities/rental-option.entity';
import { RentalOptionController } from './rental-option.controller';
import { RentalOptionService } from './rental-option.service';

@Module({
  imports: [TypeOrmModule.forFeature([RentalOption])],
  controllers: [RentalOptionController],
  providers: [RentalOptionService],
})
export class RentalOptionModule {}
