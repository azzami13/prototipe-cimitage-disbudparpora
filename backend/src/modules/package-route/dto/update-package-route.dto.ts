import { PartialType } from '@nestjs/mapped-types';
import { CreatePackageRouteDto } from './create-package-route.dto';

export class UpdatePackageRouteDto extends PartialType(CreatePackageRouteDto) {}
