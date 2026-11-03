import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { HeritageCategory } from '../../../common/enums/heritage-category.enum';

class HeritageMediaItemDto {
  @IsString()
  @IsUrl({ require_tld: false }, { message: 'URL media tidak valid' })
  url: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsBoolean()
  is_visible?: boolean;
}

export class CreateHeritageDto {
  @IsNotEmpty({ message: 'Nama situs wajib diisi' })
  @IsString()
  name: string;

  @IsEnum(HeritageCategory, {
    message: 'Kategori harus salah satu dari: BG, SI, KA, BD',
  })
  category: HeritageCategory;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  kelurahan?: string;

  @IsOptional()
  @IsString()
  kecamatan?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @IsOptional()
  @IsString()
  no_register?: string;

  @IsOptional()
  @IsString()
  sk_penetapan?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  image_url?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5, { message: 'Gambar maksimal 5 file' })
  @ValidateNested({ each: true })
  @Type(() => HeritageMediaItemDto)
  images?: HeritageMediaItemDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(2, { message: 'Link YouTube maksimal 2' })
  @ValidateNested({ each: true })
  @Type(() => HeritageMediaItemDto)
  youtube_links?: HeritageMediaItemDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(2, { message: 'File PDF maksimal 2 file' })
  @ValidateNested({ each: true })
  @Type(() => HeritageMediaItemDto)
  pdf_files?: HeritageMediaItemDto[];

  @IsOptional()
  @IsString()
  tahun_register?: string;
}
