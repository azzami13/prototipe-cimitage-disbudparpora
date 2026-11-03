import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsArray,
  IsInt,
  Min,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateTourPackageDto {
  @IsNotEmpty({ message: 'Kode paket wajib diisi' })
  @IsString()
  code: string;

  @IsNotEmpty({ message: 'Nama paket wajib diisi' })
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price_per_person?: number;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  duration_hours?: number;

  @IsOptional()
  @IsString()
  image_url?: string;

  /**
   * Array ID heritage site — urutan array = urutan sequence rute
   */
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  heritageIds?: number[];
}
