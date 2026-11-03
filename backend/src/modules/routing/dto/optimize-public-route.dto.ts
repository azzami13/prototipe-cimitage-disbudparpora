import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class PublicPickupDto {
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude: number;
}

export class OptimizePublicRouteDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => PublicPickupDto)
  pickup?: PublicPickupDto;

  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(8)
  @IsInt({ each: true })
  @Min(1, { each: true })
  destinationIds: number[];

  @IsOptional()
  @IsInt()
  @Min(1)
  fixedEndId?: number;
}
