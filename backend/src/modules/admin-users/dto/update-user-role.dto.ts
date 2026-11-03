import { IsInt, IsOptional } from 'class-validator';

export class UpdateUserRoleDto {
  @IsOptional()
  @IsInt()
  role_id?: number | null;
}
