import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { UserRole } from '../../common/enums/user-role.enum';
import { Roles } from '../../common/security/roles.decorator';
import { AuditService } from './services/audit.service';
import { OperationsService } from './services/operations.service';
import {
  SettingsService,
  SystemSettingsDto,
} from './services/settings.service';

@Controller()
export class OperationsController {
  constructor(
    private readonly settings: SettingsService,
    private readonly audit: AuditService,
    private readonly operations: OperationsService,
  ) {}

  @Get('admin/settings')
  @Roles(UserRole.ADMIN_OPERASIONAL, UserRole.SUPER_ADMIN)
  getSettings() {
    return this.settings.getSettings();
  }

  @Post('admin/settings')
  @Roles(UserRole.SUPER_ADMIN)
  async updateSettings(
    @Req() req: any,
    @Body() body: Partial<SystemSettingsDto>,
  ) {
    const result = await this.settings.updateSettings(req.user, body);
    await this.audit.record({
      actor: req.user,
      action: 'settings.update',
      entityType: 'system_setting',
      entityId: 'global',
      scope: 'system',
      metadata: body,
    });
    return result;
  }

  @Get('admin/notifications')
  @Roles(UserRole.ADMIN_OPERASIONAL, UserRole.SUPER_ADMIN)
  alerts(@Query('limit') limit?: string) {
    return this.operations.alerts(Number(limit ?? 40));
  }

  @Get('admin/audit')
  @Roles(UserRole.ADMIN_OPERASIONAL, UserRole.SUPER_ADMIN)
  auditLogs(@Req() req: any, @Query() query: Record<string, any>) {
    return this.audit.list(req.user, query);
  }

  @Get('admin/reports/operational')
  @Roles(UserRole.ADMIN_OPERASIONAL, UserRole.SUPER_ADMIN)
  report(@Query() query: Record<string, any>) {
    return this.operations.report(query);
  }

  @Get('admin/reports/operational.csv')
  @Roles(UserRole.ADMIN_OPERASIONAL, UserRole.SUPER_ADMIN)
  async csv(
    @Query() query: Record<string, any>,
    @Res({ passthrough: true }) response: Response,
  ) {
    response.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response.setHeader(
      'Content-Disposition',
      'attachment; filename="cimitage-operational-report.csv"',
    );
    return this.operations.csv(query);
  }

  @Get('bookings/:id/receipt')
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN_OPERASIONAL, UserRole.SUPER_ADMIN)
  receipt(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.operations.receipt(id, req.user);
  }
}
