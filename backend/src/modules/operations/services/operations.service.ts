import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Repository } from 'typeorm';
import { Booking } from '../../../common/entities/booking.entity';
import { DriverTrip } from '../../../common/entities/driver-trip.entity';
import { RouteOptimizationResult } from '../../../common/entities/route-optimization-result.entity';
import { Sakoci } from '../../../common/entities/sakoci.entity';
import { TripIncident } from '../../../common/entities/trip-incident.entity';
import { User } from '../../../common/entities/user.entity';
import { UserRole } from '../../../common/enums/user-role.enum';
import { AuthenticatedUser } from '../../../common/security/authenticated-user';
import { SettingsService } from './settings.service';

type ReportFilter = {
  preset?: string;
  date_from?: string;
  date_to?: string;
  status?: string;
  booking_type?: string;
};

@Injectable()
export class OperationsService {
  constructor(
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
    @InjectRepository(DriverTrip)
    private readonly tripRepo: Repository<DriverTrip>,
    @InjectRepository(TripIncident)
    private readonly incidentRepo: Repository<TripIncident>,
    @InjectRepository(RouteOptimizationResult)
    private readonly routeRepo: Repository<RouteOptimizationResult>,
    @InjectRepository(Sakoci) private readonly sakociRepo: Repository<Sakoci>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly settings: SettingsService,
  ) {}

  async alerts(limit = 40) {
    const take = Math.min(100, Math.max(1, Number(limit) || 40));
    const now = new Date();
    const soon = new Date(now.getTime() + 60 * 60_000);
    const staleGpsBefore = new Date(now.getTime() - 15 * 60_000);
    const items: any[] = [];

    const [
      payments,
      paidBookings,
      assignmentReady,
      slowStarts,
      staleGps,
      incidents,
      staleRoutes,
    ] = await Promise.all([
      this.bookingRepo.find({
        where: { payment_status: 'waiting_verification' },
        order: { created_at: 'ASC' },
        take,
      }),
      this.bookingRepo.find({
        where: { payment_status: 'paid', status: 'confirmed' },
        order: { created_at: 'ASC' },
        take,
      }),
      this.bookingRepo.find({
        where: { payment_status: 'paid', status: 'confirmed' },
        order: { visit_date: 'ASC' },
        take,
      }),
      this.tripRepo.find({
        where: {
          trip_status: In(['ASSIGNED', 'ACCEPTED'] as any),
          scheduled_user_pickup_at: Between(now, soon),
        },
        order: { scheduled_user_pickup_at: 'ASC' },
        take,
      }),
      this.tripRepo
        .createQueryBuilder('trip')
        .leftJoinAndSelect('trip.booking', 'booking')
        .where('trip.trip_status IN (:...statuses)', {
          statuses: [
            'EN_ROUTE_TO_PICKUP',
            'AT_PICKUP',
            'EN_ROUTE_TO_DESTINATION',
            'AT_DESTINATION',
            'EN_ROUTE_TO_ENDPOINT',
          ],
        })
        .andWhere(
          '(booking.vehicle_location_updated_at IS NULL OR booking.vehicle_location_updated_at < :staleGpsBefore)',
          { staleGpsBefore },
        )
        .orderBy('trip.scheduled_user_pickup_at', 'ASC')
        .limit(take)
        .getMany(),
      this.incidentRepo.find({
        where: { status: In(['OPEN', 'IN_REVIEW'] as any) },
        order: { reported_at: 'DESC' },
        take,
      }),
      this.routeRepo.find({
        where: { route_status: 'stale' as any },
        order: { updated_at: 'DESC' },
        take,
      }),
    ]);
    const paidIds = paidBookings.map((booking) => booking.id);
    const latestRoutes = paidIds.length
      ? await this.routeRepo.find({
          where: { booking_id: In(paidIds) as any },
          order: { updated_at: 'DESC' },
        })
      : [];
    const latestRouteByBooking = new Map<number, RouteOptimizationResult>();
    latestRoutes.forEach((route) => {
      if (!latestRouteByBooking.has(route.booking_id))
        latestRouteByBooking.set(route.booking_id, route);
    });
    const finalRouteBookingIds = new Set(
      [...latestRouteByBooking.values()]
        .filter((route) => route.route_status === 'final')
        .map((route) => route.booking_id),
    );

    payments.forEach((booking) =>
      items.push(
        this.alert(
          'payment_waiting_verification',
          'high',
          booking.created_at,
          `Pembayaran #${booking.id} menunggu verifikasi`,
          `/admin/booking/${booking.id}`,
        ),
      ),
    );
    paidBookings
      .filter((booking) => !finalRouteBookingIds.has(booking.id))
      .forEach((booking) =>
        items.push(
          this.alert(
            'paid_route_not_final',
            'high',
            booking.created_at,
            `Booking #${booking.id} sudah paid, route perlu finalisasi`,
            `/admin/booking/${booking.id}`,
          ),
        ),
      );
    assignmentReady
      .filter(
        (booking) =>
          !booking.assigned_driver_id ||
          !booking.assigned_tour_guide_id ||
          !booking.sakoci_id,
      )
      .forEach((booking) =>
        items.push(
          this.alert(
            'assignment_incomplete',
            'medium',
            booking.visit_date ?? booking.created_at,
            `Booking #${booking.id} siap assignment`,
            `/admin/booking/${booking.id}`,
          ),
        ),
      );
    slowStarts.forEach((trip) =>
      items.push(
        this.alert(
          'driver_not_started',
          'high',
          trip.scheduled_user_pickup_at,
          `${trip.booking_reference} mendekati jam mulai`,
          `/admin/booking/${trip.booking_id}`,
        ),
      ),
    );
    staleGps.forEach((trip) =>
      items.push(
        this.alert(
          'gps_stale',
          'medium',
          trip.booking?.vehicle_location_updated_at ??
            trip.scheduled_user_pickup_at,
          `${trip.booking_reference} GPS lama/tidak tersedia`,
          `/admin/monitoring`,
        ),
      ),
    );
    incidents.forEach((incident) =>
      items.push(
        this.alert(
          'incident_open',
          'high',
          incident.reported_at,
          `Incident ${incident.issue_type}`,
          `/admin/monitoring`,
        ),
      ),
    );
    staleRoutes.forEach((route) =>
      items.push(
        this.alert(
          'route_snapshot_stale',
          'medium',
          route.updated_at,
          `Route booking #${route.booking_id} perlu diperbarui`,
          `/admin/booking/${route.booking_id}`,
        ),
      ),
    );

    return {
      data: items
        .sort(
          (a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
        )
        .slice(0, take),
      total: items.length,
    };
  }

  async report(filter: ReportFilter) {
    const { start, end } = this.period(filter);
    const where: any = { created_at: Between(start, end) };
    if (filter.status) where.status = filter.status;
    if (filter.booking_type) where.booking_type = filter.booking_type;
    const bookings = await this.bookingRepo.find({
      where,
      relations: [
        'tour_package',
        'rental_option',
        'driver',
        'tour_guide',
        'sakoci',
      ],
      order: { created_at: 'DESC' },
      take: 1000,
    });
    const trips = await this.tripRepo.find({
      where: { created_at: Between(start, end) },
      relations: ['driver', 'tour_guide', 'sakoci'],
    });
    const incidents = await this.incidentRepo.find({
      where: { reported_at: Between(start, end) },
    });
    return {
      filter: {
        start,
        end,
        status: filter.status ?? null,
        booking_type: filter.booking_type ?? null,
      },
      summary: {
        bookingTotal: bookings.length,
        paymentStatus: this.countBy(bookings, 'payment_status'),
        bookingStatus: this.countBy(bookings, 'status'),
        completed: bookings.filter((booking) => booking.status === 'completed')
          .length,
        cancelled: bookings.filter((booking) => booking.status === 'cancelled')
          .length,
        activeTrips: trips.filter(
          (trip) => !['COMPLETED', 'CANCELLED'].includes(trip.trip_status),
        ).length,
        completedTrips: trips.filter((trip) => trip.trip_status === 'COMPLETED')
          .length,
        incidentTotal: incidents.length,
      },
      sakociUsage: this.countBy(trips, 'sakoci_id'),
      driverPerformance: this.staffRows(trips, 'driver'),
      guidePerformance: this.staffRows(trips, 'tour_guide'),
      popularServices: this.popularServices(bookings),
      incidentsByType: this.countBy(incidents, 'issue_type'),
      rows: bookings.map((booking) => this.reportRow(booking)),
    };
  }

  async csv(filter: ReportFilter) {
    const report = await this.report(filter);
    const header = [
      'booking_id',
      'created_at',
      'visit_date',
      'booking_type',
      'service',
      'status',
      'payment_status',
      'participants',
      'total_price',
    ];
    const rows = report.rows.map((row: any) =>
      header.map((key) => this.csvCell(row[key])).join(','),
    );
    return new StreamableFile(
      Buffer.from([header.join(','), ...rows].join('\n'), 'utf8'),
      {
        type: 'text/csv; charset=utf-8',
        disposition: 'attachment; filename="cimitage-operational-report.csv"',
      },
    );
  }

  async receipt(id: number, user: AuthenticatedUser) {
    const booking = await this.bookingRepo.findOne({
      where: { id },
      relations: [
        'tour_package',
        'tour_package.routes',
        'tour_package.routes.heritage_site',
        'rental_option',
        'driver',
        'tour_guide',
        'sakoci',
      ],
    });
    if (!booking) throw new NotFoundException('Booking tidak ditemukan');
    if (user.role === UserRole.CUSTOMER && booking.user_id !== user.id)
      throw new ForbiddenException('Receipt bukan milik akun ini');
    const settings = await this.settings.getSettings();
    const route = await this.routeRepo.findOne({
      where: { booking_id: booking.id },
      order: { updated_at: 'DESC' },
    });
    return {
      issuer: {
        appName: settings.appName,
        agencyName: settings.agencyName,
        support: settings.customerSupportContact,
        hotline: settings.operationalHotline,
        hours: settings.operationalHours,
      },
      booking: {
        id: booking.id,
        code: `BK-${String(booking.id).padStart(3, '0')}`,
        customer: booking.group_name,
        bookingType: booking.booking_type,
        serviceName:
          booking.tour_package?.name ??
          booking.rental_option?.name ??
          'Private tour',
        visitDate: booking.visit_date,
        pickupTime: booking.pickup_time,
        pickupLocation: booking.pickup_location,
        participants: booking.participants,
        status: booking.status,
        paymentStatus: booking.payment_status,
        amount: Number(booking.total_price ?? 0),
        paidAmount:
          booking.payment_status === 'paid'
            ? Number(booking.paid_amount ?? booking.total_price ?? 0)
            : null,
        createdAt: booking.created_at,
        notes: booking.notes,
      },
      assignment: booking.assigned_driver_id
        ? {
            sakoci: booking.sakoci
              ? {
                  name: booking.sakoci.name,
                  code: booking.sakoci.code,
                  plateNumber: booking.sakoci.plate_number,
                }
              : null,
            driver: booking.driver ? { name: booking.driver.name } : null,
            guide: booking.tour_guide
              ? { name: booking.tour_guide.name }
              : null,
          }
        : null,
      route:
        route && route.route_status === 'final'
          ? {
              totalDistanceKm: Number(route.total_distance_km ?? 0),
              totalDurationMinutes:
                route.total_duration_minutes == null
                  ? null
                  : Number(route.total_duration_minutes),
              orderedDestinationIds: route.ordered_destination_ids ?? [],
            }
          : null,
    };
  }

  private alert(
    type: string,
    priority: string,
    timestamp: Date | string | null,
    summary: string,
    href: string,
  ) {
    return {
      id: `${type}-${summary}`,
      type,
      priority,
      timestamp: timestamp ?? new Date(),
      summary,
      href,
    };
  }

  private period(filter: ReportFilter) {
    const now = new Date();
    if (filter.date_from && filter.date_to) {
      const start = new Date(filter.date_from);
      const end = new Date(filter.date_to);
      const maxMs = 366 * 24 * 60 * 60_000;
      if (end.getTime() - start.getTime() > maxMs) {
        return { start, end: new Date(start.getTime() + maxMs) };
      }
      return { start, end };
    }
    if (filter.preset === 'month')
      return {
        start: new Date(now.getFullYear(), now.getMonth(), 1),
        end: now,
      };
    const days = filter.preset === '30d' ? 30 : 7;
    return {
      start: new Date(now.getTime() - days * 24 * 60 * 60_000),
      end: now,
    };
  }

  private countBy(rows: any[], key: string) {
    return rows.reduce(
      (acc, row) => {
        const value = String(row[key] ?? 'unknown');
        acc[value] = (acc[value] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );
  }

  private staffRows(trips: DriverTrip[], relation: 'driver' | 'tour_guide') {
    const rows = new Map<
      string,
      { name: string; total: number; completed: number }
    >();
    for (const trip of trips) {
      const staff = trip[relation];
      if (!staff) continue;
      const row = rows.get(String(staff.id)) ?? {
        name: staff.name,
        total: 0,
        completed: 0,
      };
      row.total += 1;
      if (trip.trip_status === 'COMPLETED') row.completed += 1;
      rows.set(String(staff.id), row);
    }
    return [...rows.values()].sort((a, b) => b.total - a.total);
  }

  private popularServices(bookings: Booking[]) {
    const rows = new Map<
      string,
      { name: string; count: number; participants: number }
    >();
    for (const booking of bookings) {
      const name =
        booking.tour_package?.name ??
        booking.rental_option?.name ??
        booking.booking_type;
      const row = rows.get(name) ?? { name, count: 0, participants: 0 };
      row.count += 1;
      row.participants += Number(booking.participants ?? 0);
      rows.set(name, row);
    }
    return [...rows.values()].sort((a, b) => b.count - a.count).slice(0, 10);
  }

  private reportRow(booking: Booking) {
    return {
      booking_id: booking.id,
      created_at: booking.created_at,
      visit_date: booking.visit_date,
      booking_type: booking.booking_type,
      service:
        booking.tour_package?.name ??
        booking.rental_option?.name ??
        booking.booking_type,
      status: booking.status,
      payment_status: booking.payment_status,
      participants: booking.participants,
      total_price: Number(booking.total_price ?? 0),
    };
  }

  private csvCell(value: unknown) {
    const text = String(value ?? '').replaceAll('"', '""');
    const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
    return `"${safe}"`;
  }
}
