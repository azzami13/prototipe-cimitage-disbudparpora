import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { TourPackageService } from './tour-package.service';
import { CreateTourPackageDto } from './dto/create-tour-package.dto';
import { UpdateTourPackageDto } from './dto/update-tour-package.dto';
import { Public } from '../../common/security/public.decorator';
import { Roles } from '../../common/security/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';

@Controller('tour-packages')
export class TourPackageController {
  constructor(private readonly service: TourPackageService) {}

  @Get()
  @Public()
  findAll(
    @Query('active') active?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.findAll({
      active: active !== undefined ? active === 'true' : undefined,
      search,
      page: page ? +page : 1,
      limit: limit ? +limit : 10,
    });
  }

  @Get(':id')
  @Public()
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Post()
  @Roles(UserRole.ADMIN_OPERASIONAL, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateTourPackageDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  @Roles(UserRole.ADMIN_OPERASIONAL, UserRole.SUPER_ADMIN)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTourPackageDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN_OPERASIONAL, UserRole.SUPER_ADMIN)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }

  @Put(':id/toggle-active')
  @Roles(UserRole.ADMIN_OPERASIONAL, UserRole.SUPER_ADMIN)
  toggleActive(@Param('id', ParseIntPipe) id: number) {
    return this.service.toggleActive(id);
  }

  @Put(':id/reorder')
  @Roles(UserRole.ADMIN_OPERASIONAL, UserRole.SUPER_ADMIN)
  reorder(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { sequences: Array<{ routeId: number; sequence: number }> },
  ) {
    return this.service.updateRouteSequence(id, body.sequences);
  }
}
