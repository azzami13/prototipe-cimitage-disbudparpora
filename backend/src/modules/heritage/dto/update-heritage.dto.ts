import { PartialType } from '@nestjs/mapped-types';
import { CreateHeritageDto } from './create-heritage.dto';

export class UpdateHeritageDto extends PartialType(CreateHeritageDto) {}
