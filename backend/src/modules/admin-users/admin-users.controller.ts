import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import type { AccountStatus } from '../../common/entities/user.entity';
import { AdminUsersService } from './admin-users.service';
import { CreateAdminUserDto } from './dto/create-admin-user.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { Roles } from '../../common/security/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';

@Controller('admin/users')
@Roles(UserRole.SUPER_ADMIN)
export class AdminUsersController {
  constructor(private readonly service: AdminUsersService) {}

  @Get()
  findAll(
    @Query('search') search?: string,
    @Query('status') status?: AccountStatus,
    @Query('role') role?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.findAll({
      search,
      status,
      role,
      page: page ? +page : 1,
      limit: limit ? +limit : 15,
    });
  }

  @Get('roles')
  roles() {
    return this.service.roles();
  }

  @Post()
  create(@Req() req: any, @Body() dto: CreateAdminUserDto) {
    return this.service.create(dto, req.user);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Put(':id/status')
  updateStatus(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserStatusDto,
  ) {
    return this.service.updateStatus(id, dto.status, req.user);
  }

  @Put(':id/role')
  updateRole(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserRoleDto,
  ) {
    return this.service.updateRole(id, dto.role_id, req.user);
  }

  @Delete(':id')
  remove(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id, req.user);
  }
}
