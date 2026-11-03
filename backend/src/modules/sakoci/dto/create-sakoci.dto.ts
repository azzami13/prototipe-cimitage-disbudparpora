import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import type {
  SakociStatus,
  SakociTrackingVisibility,
} from '../../../common/entities/sakoci.entity';

export class CreateSakociDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  code?: string | null;

  @IsOptional()
  @IsString()
  plate_number?: string | null;

  @IsOptional()
  @IsString()
  image_url?: string | null;

  @IsOptional()
  @IsIn(['available', 'assigned', 'maintenance', 'inactive'])
  status?: SakociStatus;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsBoolean()
  tracking_enabled?: boolean;

  @IsOptional()
  @IsIn(['public', 'user', 'admin', 'hidden'])
  tracking_visibility?: SakociTrackingVisibility;

  @IsOptional()
  @IsNumber()
  latitude?: number | null;

  @IsOptional()
  @IsNumber()
  longitude?: number | null;

  @IsOptional()
  @IsString()
  notes?: string | null;
}
