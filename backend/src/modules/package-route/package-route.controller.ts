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
import { PackageRouteService } from './package-route.service';
import { CreatePackageRouteDto } from './dto/create-package-route.dto';
import { UpdatePackageRouteDto } from './dto/update-package-route.dto';
import { Public } from '../../common/security/public.decorator';
import { Roles } from '../../common/security/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';

@Controller('package-routes')
export class PackageRouteController {
  constructor(private readonly service: PackageRouteService) {}

  /**
   * GET /api/package-routes
   * GET /api/package-routes?tour_package_id=1
   */
  @Get()
  @Public()
  findAll(@Query('tour_package_id') tourPackageId?: string) {
    return this.service.findAll(tourPackageId ? +tourPackageId : undefined);
  }

  /**
   * GET /api/package-routes/:id
   */
  @Get(':id')
  @Public()
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  /**
   * POST /api/package-routes
   * Tambah satu situs ke paket
   */
  @Post()
  @Roles(UserRole.ADMIN_OPERASIONAL, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreatePackageRouteDto) {
    return this.service.create(dto);
  }

  /**
   * PUT /api/package-routes/:id
   * Update sequence atau notes satu route
   */
  @Put(':id')
  @Roles(UserRole.ADMIN_OPERASIONAL, UserRole.SUPER_ADMIN)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePackageRouteDto,
  ) {
    return this.service.update(id, dto);
  }

  /**
   * DELETE /api/package-routes/:id
   * Hapus satu route dari paket
   */
  @Delete(':id')
  @Roles(UserRole.ADMIN_OPERASIONAL, UserRole.SUPER_ADMIN)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }

  /**
   * PUT /api/package-routes/by-package/:tourPackageId/reorder
   * Bulk reorder semua route dalam satu paket
   * Body: { items: [{ id, sequence }] }
   */
  @Put('by-package/:tourPackageId/reorder')
  @Roles(UserRole.ADMIN_OPERASIONAL, UserRole.SUPER_ADMIN)
  bulkReorder(
    @Param('tourPackageId', ParseIntPipe) tourPackageId: number,
    @Body() body: { items: Array<{ id: number; sequence: number }> },
  ) {
    return this.service.bulkReorder(tourPackageId, body.items);
  }

  /**
   * DELETE /api/package-routes/by-package/:tourPackageId
   * Hapus semua route dalam satu paket
   */
  @Delete('by-package/:tourPackageId')
  @Roles(UserRole.ADMIN_OPERASIONAL, UserRole.SUPER_ADMIN)
  removeAllByPackage(
    @Param('tourPackageId', ParseIntPipe) tourPackageId: number,
  ) {
    return this.service.removeAllByPackage(tourPackageId);
  }
}
