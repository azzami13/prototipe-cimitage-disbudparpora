import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePackageRouteDto {
  @IsNotEmpty()
  @Type(() => Number)
  @IsInt()
  tour_package_id: number;

  @IsNotEmpty()
  @Type(() => Number)
  @IsInt()
  heritage_site_id: number;

  @IsNotEmpty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sequence: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
