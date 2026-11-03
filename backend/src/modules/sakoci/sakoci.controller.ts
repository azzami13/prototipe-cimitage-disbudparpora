import {
  BadRequestException,
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
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SakociService } from './sakoci.service';
import { CreateSakociDto } from './dto/create-sakoci.dto';
import { UpdateSakociDto } from './dto/update-sakoci.dto';
import { Public } from '../../common/security/public.decorator';
import { Roles } from '../../common/security/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { createUploadOptions } from '../../common/upload/upload-options';
import { StorageService } from '../../common/storage/storage.service';

@Controller('sakoci')
export class SakociController {
  constructor(
    private readonly service: SakociService,
    private readonly storage: StorageService,
  ) {}

  @Get()
  @Roles(UserRole.ADMIN_OPERASIONAL, UserRole.SUPER_ADMIN)
  findAll(@Query('active') active?: string) {
    return this.service.findAll({
      active: active === undefined ? undefined : active === 'true',
    });
  }

  @Get('public')
  @Public()
  publicList() {
    return this.service.findAll({ publicOnly: true });
  }

  @Get(':id')
  @Roles(UserRole.ADMIN_OPERASIONAL, UserRole.SUPER_ADMIN)
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Post()
  @Roles(UserRole.ADMIN_OPERASIONAL, UserRole.SUPER_ADMIN)
  create(@Body() dto: CreateSakociDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  @Roles(UserRole.ADMIN_OPERASIONAL, UserRole.SUPER_ADMIN)
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateSakociDto) {
    return this.service.update(id, dto);
  }

  @Post(':id/image')
  @UseInterceptors(FileInterceptor('file', createUploadOptions('sakoci')))
  @Roles(UserRole.ADMIN_OPERASIONAL, UserRole.SUPER_ADMIN)
  async uploadImage(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: any,
    @Req() req: any,
  ) {
    if (!file) throw new BadRequestException('Foto Sakoci wajib diunggah');
    const previous = await this.service.findOne(id);
    const stored = await this.storage.fromUploadedFile(req, 'sakoci', file);
    const sakoci = await this.service.update(id, { image_url: stored.url });
    await this.storage.deleteIfManaged(previous.image_url);
    return {
      url: stored.url,
      filename: stored.filename,
      mimetype: stored.mimetype,
      sakoci,
    };
  }

  @Put(':id/location')
  @Roles(UserRole.ADMIN_OPERASIONAL, UserRole.SUPER_ADMIN)
  updateLocation(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { latitude?: number; longitude?: number },
  ) {
    return this.service.updateLocation(id, body);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN_OPERASIONAL, UserRole.SUPER_ADMIN)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
