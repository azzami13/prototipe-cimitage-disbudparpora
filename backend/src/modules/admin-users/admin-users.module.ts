import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Role } from '../../common/entities/role.entity';
import { User } from '../../common/entities/user.entity';
import { AdminUsersController } from './admin-users.controller';
import { AdminUsersService } from './admin-users.service';
import { OperationsModule } from '../operations/operations.module';

@Module({
  imports: [TypeOrmModule.forFeature([User, Role]), OperationsModule],
  controllers: [AdminUsersController],
  providers: [AdminUsersService],
})
export class AdminUsersModule {}
