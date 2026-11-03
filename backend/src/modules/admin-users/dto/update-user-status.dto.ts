import { IsIn } from 'class-validator';
import type { AccountStatus } from '../../../common/entities/user.entity';

export class UpdateUserStatusDto {
  @IsIn(['normal', 'suspended', 'review', 'deleted'])
  status: AccountStatus;
}
