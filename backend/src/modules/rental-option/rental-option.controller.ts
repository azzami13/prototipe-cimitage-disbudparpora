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
} from '@nestjs/common';
import { RentalOptionService } from './rental-option.service';
import { CreateRentalOptionDto } from './dto/create-rental-option.dto';
import { UpdateRentalOptionDto } from './dto/update-rental-option.dto';
import { Public } from '../../common/security/public.decorator';
import { Roles } from '../../common/security/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';

@Controller('rental-options')
export class RentalOptionController {
  constructor(private readonly service: RentalOptionService) {}

  @Get()
  @Public()
  findAll(@Query('active') active?: string) {
    return this.service.findAll(
      active === undefined ? undefined : active === 'true',
    );
  }

  @Post()
  @Roles(UserRole.ADMIN_OPERASIONAL, UserRole.SUPER_ADMIN)
  create(@Body() dto: CreateRentalOptionDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  @Roles(UserRole.ADMIN_OPERASIONAL, UserRole.SUPER_ADMIN)
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRentalOptionDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN_OPERASIONAL, UserRole.SUPER_ADMIN)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
