import { PartialType } from '@nestjs/mapped-types';
import { CreateSakociDto } from './create-sakoci.dto';

export class UpdateSakociDto extends PartialType(CreateSakociDto) {}
