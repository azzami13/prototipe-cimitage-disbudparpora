import 'reflect-metadata';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
import { ROLES_KEY } from '../../common/security/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { OperationsController } from './operations.controller';
import { AuditService } from './services/audit.service';
import { OperationsService } from './services/operations.service';
import { SettingsService } from './services/settings.service';

describe('Phase 5 operations', () => {
  it('allows only super admin to update settings while admins can read', () => {
    expect(
      Reflect.getMetadata(
        ROLES_KEY,
        OperationsController.prototype.getSettings,
      ),
    ).toEqual([UserRole.ADMIN_OPERASIONAL, UserRole.SUPER_ADMIN]);
    expect(
      Reflect.getMetadata(
        ROLES_KEY,
        OperationsController.prototype.updateSettings,
      ),
    ).toEqual([UserRole.SUPER_ADMIN]);
  });

  it('keeps notification center and audit admin-only', () => {
    expect(
      Reflect.getMetadata(ROLES_KEY, OperationsController.prototype.alerts),
    ).toEqual([UserRole.ADMIN_OPERASIONAL, UserRole.SUPER_ADMIN]);
    expect(
      Reflect.getMetadata(ROLES_KEY, OperationsController.prototype.auditLogs),
    ).toEqual([UserRole.ADMIN_OPERASIONAL, UserRole.SUPER_ADMIN]);
    expect(
      Reflect.getMetadata(ROLES_KEY, OperationsController.prototype.report),
    ).toEqual([UserRole.ADMIN_OPERASIONAL, UserRole.SUPER_ADMIN]);
    expect(
      Reflect.getMetadata(ROLES_KEY, OperationsController.prototype.csv),
    ).toEqual([UserRole.ADMIN_OPERASIONAL, UserRole.SUPER_ADMIN]);
    expect(
      Reflect.getMetadata(ROLES_KEY, OperationsController.prototype.receipt),
    ).toEqual([
      UserRole.CUSTOMER,
      UserRole.ADMIN_OPERASIONAL,
      UserRole.SUPER_ADMIN,
    ]);
  });

  it('updates database settings and exposes driver ready offset for operations', async () => {
    const rows: any[] = [];
    const service = new SettingsService({
      find: jest.fn(async () => rows),
      manager: {
        transaction: jest.fn(async (callback) =>
          callback({
            upsert: jest.fn(async (_entity, value) => rows.push(value)),
          }),
        ),
      },
    } as any);

    await service.updateSettings({ id: 1, role: UserRole.SUPER_ADMIN } as any, {
      driverReadyOffsetMinutes: 45,
    });

    expect(await service.getDriverReadyOffsetMinutes()).toBe(45);
  });

  it('rejects loose boolean settings, invalid hours, and secret-like keys', async () => {
    const service = new SettingsService({
      find: jest.fn(async () => []),
      manager: { transaction: jest.fn() },
    } as any);

    await expect(
      service.updateSettings({ id: 1, role: UserRole.SUPER_ADMIN } as any, {
        trackingEnabled: 'false' as any,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.updateSettings({ id: 1, role: UserRole.SUPER_ADMIN } as any, {
        operationalHours: 'setiap hari',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.updateSettings(
        { id: 1, role: UserRole.SUPER_ADMIN } as any,
        { jwtSecret: 'nope' } as any,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('sanitizes audit metadata and removes sensitive fields', () => {
    const service = new AuditService({} as any);
    expect(
      service.sanitize({
        payment_proof_url: 'secret-path',
        token: 'jwt',
        password: 'pw',
        pickup_location: 'Alamat lengkap',
        status: 'paid',
        nested: { contact_phone: '0812', safe: true },
      }),
    ).toEqual({ status: 'paid', nested: { safe: true } });
  });

  it('limits admin operasional audit scope to operational logs', async () => {
    const findAndCount = jest.fn(async () => [
      [{ id: 1, metadata: { token: 'x', safe: true } }],
      1,
    ]);
    const service = new AuditService({ findAndCount } as any);
    const result = await service.list(
      { id: 2, role: UserRole.ADMIN_OPERASIONAL } as any,
      {},
    );
    expect(findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ scope: 'operational' }),
      }),
    );
    expect(result.data[0].metadata).toEqual({ safe: true });
  });

  it('builds every operational alert from repository-backed conditions', async () => {
    const now = new Date();
    const paidWithoutFinal = {
      id: 8,
      created_at: now,
      visit_date: now,
      payment_status: 'paid',
      status: 'confirmed',
      assigned_driver_id: null,
      assigned_tour_guide_id: null,
      sakoci_id: null,
    };
    const service = new OperationsService(
      {
        find: jest
          .fn()
          .mockResolvedValueOnce([
            { id: 7, created_at: now, payment_status: 'waiting_verification' },
          ])
          .mockResolvedValueOnce([paidWithoutFinal])
          .mockResolvedValueOnce([paidWithoutFinal]),
      } as any,
      {
        find: jest.fn(async () => [
          {
            id: 2,
            booking_id: 8,
            booking_reference: 'BK-008',
            scheduled_user_pickup_at: now,
            trip_status: 'ASSIGNED',
          },
        ]),
        createQueryBuilder: () =>
          qb([
            {
              id: 4,
              booking_id: 8,
              booking_reference: 'BK-008',
              scheduled_user_pickup_at: now,
              booking: { vehicle_location_updated_at: null },
            },
          ]),
      } as any,
      {
        find: jest.fn(async () => [
          { id: 3, issue_type: 'GPS', status: 'OPEN', reported_at: now },
        ]),
      } as any,
      {
        find: jest
          .fn()
          .mockResolvedValueOnce([
            { booking_id: 9, route_status: 'stale', updated_at: now },
          ])
          .mockResolvedValueOnce([]),
      } as any,
      {} as any,
      {} as any,
      {} as any,
    );

    const result = await service.alerts(20);
    expect(result.data.map((item: any) => item.type)).toEqual(
      expect.arrayContaining([
        'payment_waiting_verification',
        'paid_route_not_final',
        'assignment_incomplete',
        'driver_not_started',
        'gps_stale',
        'incident_open',
        'route_snapshot_stale',
      ]),
    );
    expect(
      result.data.every(
        (item: any) =>
          item.type &&
          item.priority &&
          item.timestamp &&
          item.summary &&
          item.href,
      ),
    ).toBe(true);
  });

  it('applies report filters and neutralizes CSV formula injection for risky prefixes', async () => {
    const maliciousBooking = {
      id: 1,
      created_at: new Date(),
      visit_date: new Date(),
      booking_type: 'package',
      tour_package: { name: '=SUM(A1:A2)' },
      status: 'completed',
      payment_status: 'paid',
      participants: 2,
      total_price: 1000,
    };
    const bookingFind = jest.fn(async () => [maliciousBooking]);
    const service = new OperationsService(
      { find: bookingFind } as any,
      { find: jest.fn(async () => []) } as any,
      { find: jest.fn(async () => []) } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    const report = await service.report({ preset: '7d', status: 'completed' });
    expect(report.summary.bookingTotal).toBe(1);
    expect(bookingFind).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'completed' }),
        take: 1000,
      }),
    );
    expect((service as any).csvCell('=SUM(A1:A2)')).toBe('"\'=SUM(A1:A2)"');
    expect((service as any).csvCell('+SUM(A1:A2)')).toBe(
      '"\' +SUM(A1:A2)"'.replace(' ', ''),
    );
    expect((service as any).csvCell('-10')).toBe('"\'-10"');
    expect((service as any).csvCell('@cmd')).toBe('"\'@cmd"');
  });

  it('enforces receipt ownership and never labels unpaid bookings as paid', async () => {
    const service = new OperationsService(
      {
        findOne: jest.fn(async () => ({
          id: 4,
          user_id: 99,
          group_name: 'A',
          payment_status: 'unpaid',
          status: 'pending',
          total_price: 10,
          participants: 1,
          booking_type: 'private',
          created_at: new Date(),
        })),
      } as any,
      {} as any,
      {} as any,
      { findOne: jest.fn(async () => null) } as any,
      {} as any,
      {} as any,
      {
        getSettings: jest.fn(async () => ({
          appName: 'C',
          agencyName: 'D',
          customerSupportContact: 'help',
          operationalHotline: '112',
          operationalHours: '08-16',
        })),
      } as any,
    );

    await expect(
      service.receipt(4, { id: 7, role: UserRole.CUSTOMER } as any),
    ).rejects.toBeInstanceOf(ForbiddenException);
    const receipt = await service.receipt(4, {
      id: 99,
      role: UserRole.CUSTOMER,
    } as any);
    expect(receipt.booking.paymentStatus).toBe('unpaid');
    expect(receipt.booking.paidAmount).toBeNull();
    expect(receipt.assignment).toBeNull();
  });

  it('has audit hooks for required Phase 5 actions', () => {
    const bookingService = source('modules/booking/booking.service.ts');
    const tripService = source('modules/driver-trip/driver-trip.service.ts');
    const settingsController = source(
      'modules/operations/operations.controller.ts',
    );
    const usersService = source('modules/admin-users/admin-users.service.ts');
    const graphController = source('modules/graph/graph.controller.ts');
    const all = [
      bookingService,
      tripService,
      settingsController,
      usersService,
      graphController,
    ].join('\n');
    [
      'payment.verify',
      'payment.reject',
      'assignment.create',
      'assignment.reassign',
      'booking.cancel',
      'route.finalize',
      'route.reoptimize',
      'trip.status.update',
      'incident.create',
      'incident.resolve',
      'settings.update',
      'user.role.update',
      'graph.rebuild_matrix',
    ].forEach((action) => expect(all).toContain(action));
  });

  it('keeps frontend operations pages API-backed without demo fallback settings or print shortcut', () => {
    const settingsPage = frontend('app/admin/settings/page.tsx');
    const notificationsPage = frontend('app/admin/notifications/page.tsx');
    const reportsPage = frontend('app/admin/reports/page.tsx');
    const bookingDetail = frontend('app/booking/[id]/page.tsx');
    expect(settingsPage).not.toContain('localStorage');
    expect(settingsPage).toContain('api.operations.settings');
    expect(notificationsPage).toContain('api.operations.notifications');
    expect(reportsPage).toContain('api.operations.report');
    expect(bookingDetail).toContain('/receipt');
    expect(bookingDetail).not.toContain('window.print()');
  });
});

function qb(result: any[]) {
  const chain: any = {
    leftJoinAndSelect: jest.fn(() => chain),
    where: jest.fn(() => chain),
    andWhere: jest.fn(() => chain),
    orderBy: jest.fn(() => chain),
    limit: jest.fn(() => chain),
    getMany: jest.fn(async () => result),
  };
  return chain;
}

function source(path: string) {
  return readFileSync(join(process.cwd(), 'src', path), 'utf8');
}

function frontend(path: string) {
  return readFileSync(join(process.cwd(), '..', 'frontend', path), 'utf8');
}
