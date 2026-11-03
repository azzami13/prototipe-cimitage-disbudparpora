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
  BadRequestException,
  UploadedFile,
  UseInterceptors,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { HeritageService } from './heritage.service';
import { CreateHeritageDto } from './dto/create-heritage.dto';
import { UpdateHeritageDto } from './dto/update-heritage.dto';
import { Public } from '../../common/security/public.decorator';
import { Roles } from '../../common/security/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { createUploadOptions } from '../../common/upload/upload-options';
import { Throttle } from '@nestjs/throttler';
import { StorageService } from '../../common/storage/storage.service';

@Controller('heritage')
export class HeritageController {
  constructor(
    private readonly service: HeritageService,
    private readonly storage: StorageService,
  ) {}

  // ─── List dengan filter + pagination ───────────────────────────────────────
  @Get()
  @Public()
  @Throttle({ default: { limit: 300, ttl: 60_000 } })
  findAll(
    @Query('category') category?: string,
    @Query('kecamatan') kecamatan?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('latitude') latitude?: string,
    @Query('longitude') longitude?: string,
    @Query('sort') sort?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.findAll({
      category,
      kecamatan,
      search,
      status,
      latitude: latitude ? +latitude : undefined,
      longitude: longitude ? +longitude : undefined,
      sort,
      page: page ? +page : 1,
      limit: limit ? +limit : 15,
    });
  }

  // ─── GeoJSON endpoint untuk Leaflet ────────────────────────────────────────
  @Get('geojson')
  @Public()
  @Throttle({ default: { limit: 300, ttl: 60_000 } })
  getGeoJson() {
    return this.service.findAllGeoJson();
  }

  // ─── Statistik ringkasan ────────────────────────────────────────────────────
  @Get('stats/summary')
  @Public()
  getSummary() {
    return this.service.getSummary();
  }

  @Get('stats/category')
  @Public()
  getStatsByCategory() {
    return this.service.getStatsByCategory();
  }

  @Get('stats/kecamatan')
  @Public()
  getStatsByKecamatan() {
    return this.service.getStatsByKecamatan();
  }

  // ─── Detail satu situs ──────────────────────────────────────────────────────
  @Get(':id')
  @Public()
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  // ─── Create ─────────────────────────────────────────────────────────────────
  @Post()
  @Roles(UserRole.ADMIN_OPERASIONAL, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateHeritageDto) {
    return this.service.create(dto);
  }

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', createUploadOptions('heritage', true)),
  )
  @Roles(UserRole.ADMIN_OPERASIONAL, UserRole.SUPER_ADMIN)
  async upload(@UploadedFile() file: any, @Req() req: any) {
    if (!file) throw new BadRequestException('File wajib diunggah');
    const stored = await this.storage.fromUploadedFile(req, 'heritage', file);
    return {
      url: stored.url,
      filename: stored.filename,
      mimetype: stored.mimetype,
    };
  }

  // ─── Update ─────────────────────────────────────────────────────────────────
  @Put(':id')
  @Roles(UserRole.ADMIN_OPERASIONAL, UserRole.SUPER_ADMIN)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateHeritageDto,
  ) {
    return this.service.update(id, dto);
  }

  // ─── Delete ─────────────────────────────────────────────────────────────────
  @Delete(':id')
  @Roles(UserRole.ADMIN_OPERASIONAL, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
