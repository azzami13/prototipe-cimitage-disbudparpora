import { Controller, Get, Query } from '@nestjs/common';
import { Roles } from '../../common/security/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { BookingService } from './booking.service';

@Controller('admin/dashboard')
export class AdminDashboardController {
  constructor(private readonly bookingService: BookingService) {}

  @Get('summary')
  @Roles(UserRole.ADMIN_OPERASIONAL, UserRole.SUPER_ADMIN)
  summary(@Query('period') period?: '7d' | '30d' | 'month') {
    const safePeriod = ['7d', '30d', 'month'].includes(String(period))
      ? period
      : '7d';
    return this.bookingService.getAdminDashboardSummary(safePeriod);
  }
}
