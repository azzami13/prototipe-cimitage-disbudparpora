import {
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import type { AccountStatus } from '../../../common/entities/user.entity';

export class CreateAdminUserDto {
  @IsString()
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsString()
  nik: string;

  @IsString()
  birth_place: string;

  @IsString()
  birth_date: string;

  @IsString()
  domicile: string;

  @IsString()
  ktp_address: string;

  @IsOptional()
  @IsInt()
  role_id?: number;

  @IsOptional()
  @IsIn(['normal', 'suspended', 'review', 'deleted'])
  account_status?: AccountStatus;
}
