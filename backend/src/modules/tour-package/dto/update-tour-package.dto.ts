import { PartialType } from '@nestjs/mapped-types';
import { CreateTourPackageDto } from './create-tour-package.dto';

export class UpdateTourPackageDto extends PartialType(CreateTourPackageDto) {}
