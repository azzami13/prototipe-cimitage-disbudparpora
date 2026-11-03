import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, DataSource, In } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import {
  IsArray,
  IsEmail,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import {
  Booking,
  BookingStatus,
  PaymentStatus,
} from '../../common/entities/booking.entity';
import { TourPackage } from '../../common/entities/tour-package.entity';
import { User } from '../../common/entities/user.entity';
import { RentalOption } from '../../common/entities/rental-option.entity';
import { HeritageSite } from '../../common/entities/heritage-site.entity';
import { Sakoci } from '../../common/entities/sakoci.entity';
import { RouteOptimizationResult } from '../../common/entities/route-optimization-result.entity';
import { DriverTrip } from '../../common/entities/driver-trip.entity';
import { TripIncident } from '../../common/entities/trip-incident.entity';
import { RoutingService } from '../routing/routing.service';
import { AuditService } from '../operations/services/audit.service';
import { SettingsService } from '../operations/services/settings.service';
import { AuthenticatedUser } from '../../common/security/authenticated-user';
import { UserRole } from '../../common/enums/user-role.enum';
import { createHash } from 'crypto';
import { StorageService } from '../../common/storage/storage.service';
import {
  assertBookingAssignable,
  assertBookingPayable,
  assertPaymentVerifiable,
  assertBookingStatusTransition,
  canCancelBooking,
  syncBookingStatusFromPayment,
} from './booking-status.service';

export class CreateBookingDto {
  @IsOptional()
  @IsIn(['package', 'rental', 'private'])
  booking_type?: 'package' | 'rental' | 'private';

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  groupName?: string;

  @IsOptional()
  @IsString()
  nama_rombongan?: string;

  @IsOptional()
  @IsString()
  namaRombongan?: string;

  @IsOptional()
  @IsString()
  group_name?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  tour_package_id: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  rental_option_id?: number;

  @IsOptional()
  @IsString()
  visit_date: string;

  @IsInt()
  @Min(1)
  participants: number;

  @IsString()
  password: string;

  @IsString()
  nik: string;

  @IsString()
  birth_place: string;

  @IsString()
  birth_date: string;

  @IsString()
  domicile: string;

  @IsString()
  ktp_address: string;

  @IsOptional()
  @IsString()
  pickup_time?: string;

  @IsOptional()
  @IsString()
  pickup_location?: string;

  @IsOptional()
  @IsString()
  pickup_maps_url?: string;

  @IsOptional()
  @IsNumber()
  pickup_latitude?: number;

  @IsOptional()
  @IsNumber()
  pickup_longitude?: number;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  private_destination_ids?: number[];

  @IsOptional()
  @IsString()
  contact_phone?: string;

  @IsOptional()
  @IsEmail()
  contact_email?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsInt()
  user_id?: number;
}

export class UpdateBookingTravelDto {
  @IsOptional()
  @IsString()
  group_name?: string;

  @IsOptional()
  @IsString()
  visit_date?: string;

  @IsOptional()
  @IsString()
  pickup_time?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  participants?: number;

  @IsOptional()
  @IsString()
  pickup_location?: string;

  @IsOptional()
  @IsString()
  pickup_maps_url?: string;

  @IsOptional()
  @IsNumber()
  pickup_latitude?: number;

  @IsOptional()
  @IsNumber()
  pickup_longitude?: number;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  private_destination_ids?: number[];

  @IsOptional()
  @IsString()
  contact_phone?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

type BookingAvailabilityQuery = {
  booking_type?: 'package' | 'rental' | 'private';
  tour_package_id?: string | number;
  visit_date?: string;
  pickup_time?: string;
  duration_minutes?: string | number;
  destination_count?: string | number;
  participants?: string | number;
};

@Injectable()
export class BookingService {
  private readonly logger = new Logger(BookingService.name);

  constructor(
    @InjectRepository(Booking)
    private readonly bookingRepo: Repository<Booking>,
    @InjectRepository(TourPackage)
    private readonly pkgRepo: Repository<TourPackage>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(RentalOption)
    private readonly rentalOptionRepo: Repository<RentalOption>,
    @InjectRepository(HeritageSite)
    private readonly heritageRepo: Repository<HeritageSite>,
    @InjectRepository(Sakoci)
    private readonly sakociRepo: Repository<Sakoci>,
    @InjectRepository(RouteOptimizationResult)
    private readonly routeOptimizationRepo: Repository<RouteOptimizationResult>,
    @InjectRepository(DriverTrip)
    private readonly driverTripRepo: Repository<DriverTrip>,
    @InjectRepository(TripIncident)
    private readonly tripIncidentRepo: Repository<TripIncident>,
    private readonly routingService: RoutingService,
    private readonly auditService: AuditService,
    private readonly settingsService: SettingsService,
    private readonly dataSource: DataSource,
    private readonly storage: StorageService,
  ) {}

  async findAll(filter?: {
    status?: string;
    date_from?: string;
    date_to?: string;
    page?: number;
    limit?: number;
  }) {
    const { status, date_from, date_to, page = 1, limit = 20 } = filter || {};
    const where: any = {};
    if (status) where.status = status;
    if (date_from && date_to) {
      where.visit_date = Between(new Date(date_from), new Date(date_to));
    }

    const [data, total] = await this.bookingRepo.findAndCount({
      where,
      relations: [
        'tour_package',
        'user',
        'tour_guide',
        'driver',
        'rental_option',
        'sakoci',
      ],
      order: { created_at: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, total, page, limit };
  }

  async findOne(id: number) {
    const b = await this.bookingRepo.findOne({
      where: { id },
      relations: [
        'tour_package',
        'tour_package.routes',
        'tour_package.routes.heritage_site',
        'rental_option',
        'user',
        'tour_guide',
        'driver',
        'sakoci',
      ],
    });
    if (!b) throw new NotFoundException('Booking tidak ditemukan');

    const privateDestinationIds = (b.private_destination_ids ?? [])
      .map(Number)
      .filter(
        (destinationId) => Number.isInteger(destinationId) && destinationId > 0,
      );
    if (privateDestinationIds.length > 0) {
      const destinations = await this.heritageRepo.find({
        where: { id: In(privateDestinationIds) },
      });
      (b as any).private_destinations = privateDestinationIds
        .map((destinationId) =>
          destinations.find((destination) => destination.id === destinationId),
        )
        .filter(Boolean);
    }

    return b;
  }

  async findMyBookings(userId: number) {
    const bookings = await this.bookingRepo.find({
      where: { user_id: userId },
      relations: [
        'tour_package',
        'tour_package.routes',
        'tour_package.routes.heritage_site',
        'rental_option',
        'tour_guide',
        'driver',
        'sakoci',
      ],
      order: { created_at: 'DESC' },
    });

    return bookings.map((booking) => this.sanitizeCustomerBooking(booking));
  }

  async findOneForUser(id: number, user: AuthenticatedUser) {
    const booking = await this.findOne(id);
    this.assertBookingAccess(booking, user);
    return user.role === UserRole.CUSTOMER
      ? this.sanitizeCustomerBooking(booking)
      : booking;
  }

  assertBookingAccess(booking: Booking, user: AuthenticatedUser) {
    const isAdmin = [UserRole.ADMIN_OPERASIONAL, UserRole.SUPER_ADMIN].includes(
      user.role,
    );
    if (!isAdmin && booking.user_id !== user.id) {
      throw new NotFoundException('Booking tidak ditemukan');
    }
  }

  async assertBookingAccessById(id: number, user: AuthenticatedUser) {
    const booking = await this.bookingRepo.findOne({ where: { id } });
    if (!booking) throw new NotFoundException('Booking tidak ditemukan');
    this.assertBookingAccess(booking, user);
  }

  async create(dto: CreateBookingDto) {
    return this.createInternal(dto);
  }

  async createForAuthenticatedCustomer(
    dto: CreateBookingDto,
    user: AuthenticatedUser,
  ) {
    const existingUser = await this.userRepo.findOne({
      where: { id: user.id },
    });
    if (
      !existingUser ||
      !existingUser.active ||
      existingUser.account_status !== 'normal'
    ) {
      throw new BadRequestException('Akun customer tidak aktif');
    }
    return this.createInternal(dto, existingUser);
  }

  async checkAvailability(query: BookingAvailabilityQuery) {
    const bookingType = query.booking_type ?? 'package';
    const visitDate = this.parseVisitDate(query.visit_date);
    const pickupTime = this.parsePickupTime(query.pickup_time);
    const participants =
      query.participants == null ? undefined : Number(query.participants);
    if (
      participants !== undefined &&
      (!Number.isInteger(participants) || participants < 1)
    ) {
      throw new BadRequestException('Jumlah peserta tidak valid');
    }
    const durationMinutes = await this.resolveBookingDurationMinutes({
      booking_type: bookingType,
      tour_package_id:
        query.tour_package_id == null
          ? undefined
          : Number(query.tour_package_id),
      duration_minutes:
        query.duration_minutes == null
          ? undefined
          : Number(query.duration_minutes),
      destination_count:
        query.destination_count == null
          ? undefined
          : Number(query.destination_count),
    });
    const slot = this.buildJakartaSlot(visitDate, pickupTime, durationMinutes);
    return this.getSlotAvailability(
      slot.start,
      slot.end,
      undefined,
      participants,
    );
  }

  private async createInternal(
    dto: CreateBookingDto,
    authenticatedCustomer?: User,
  ) {
    const bookingType = dto.booking_type ?? 'package';
    const groupName = (
      dto.group_name ??
      dto.groupName ??
      dto.nama_rombongan ??
      dto.namaRombongan ??
      dto.name
    )?.trim();
    if (!groupName) {
      throw new BadRequestException('Nama rombongan wajib diisi');
    }

    const tourPackageId = Number(dto.tour_package_id);
    if (
      bookingType === 'package' &&
      (!Number.isInteger(tourPackageId) || tourPackageId < 1)
    ) {
      throw new BadRequestException('Pilih paket wisata yang valid');
    }

    const participants = Number(dto.participants);
    if (
      !Number.isInteger(participants) ||
      participants < 1 ||
      participants > 1000
    ) {
      throw new BadRequestException('Jumlah peserta harus 1 sampai 1000');
    }

    const visitDate = this.parseVisitDate(dto.visit_date);
    const pickupTime = this.parsePickupTime(dto.pickup_time);
    const email = this.normalizeEmail(dto.contact_email);
    const password = dto.password?.trim();

    if (!email) {
      throw new BadRequestException('Email wajib diisi');
    }

    if (!authenticatedCustomer && (!password || password.length < 6)) {
      throw new BadRequestException('Password minimal 6 karakter');
    }

    const profile = authenticatedCustomer
      ? undefined
      : this.validateIdentityProfile(dto);
    const existingUser = await this.userRepo.findOne({ where: { email } });
    if (!authenticatedCustomer && existingUser) {
      throw new ConflictException({
        code: 'ACCOUNT_AUTHENTICATION_REQUIRED',
        message:
          'Email sudah terdaftar. Silakan login untuk melanjutkan booking.',
      });
    }
    if (
      authenticatedCustomer &&
      existingUser &&
      existingUser.id !== authenticatedCustomer.id
    ) {
      throw new BadRequestException(
        'Email kontak harus sesuai akun login atau gunakan email lain',
      );
    }

    let total_price = 0;
    let rentalOptionId: number | undefined;
    let privateDestinationIds: number[] | undefined;
    let durationMinutes = 120;

    if (bookingType === 'package') {
      const pkg = await this.pkgRepo.findOne({ where: { id: tourPackageId } });
      if (!pkg) throw new NotFoundException('Paket wisata tidak ditemukan');
      if (!pkg.active)
        throw new BadRequestException('Paket wisata tidak aktif');

      const packagePrice = Number(pkg.price_per_person);
      if (!Number.isFinite(packagePrice)) {
        throw new BadRequestException('Harga paket wisata tidak valid');
      }
      total_price = packagePrice * participants;
      durationMinutes = this.durationHoursToMinutes(pkg.duration_hours, 120);
    } else if (bookingType === 'rental') {
      rentalOptionId = Number(dto.rental_option_id);
      if (!Number.isInteger(rentalOptionId) || rentalOptionId < 1) {
        throw new BadRequestException('Pilih opsi sewa yang valid');
      }
      if (!dto.pickup_location?.trim()) {
        throw new BadRequestException('Tempat jemput wajib diisi');
      }
      if (!dto.pickup_maps_url?.trim()) {
        throw new BadRequestException('Tag/link maps wajib diisi');
      }
      if (!this.hasPickupCoordinate(dto)) {
        throw new BadRequestException('Titik jemput di peta wajib dipilih');
      }

      const option = await this.rentalOptionRepo.findOne({
        where: { id: rentalOptionId },
      });
      if (!option) throw new NotFoundException('Opsi sewa tidak ditemukan');
      if (!option.active)
        throw new BadRequestException('Opsi sewa tidak aktif');

      total_price =
        Number(option.base_price) +
        Number(option.price_per_person) * participants;
      durationMinutes = 120;
    } else if (bookingType === 'private') {
      privateDestinationIds = (dto.private_destination_ids ?? [])
        .map(Number)
        .filter((id) => Number.isInteger(id) && id > 0);
      if (privateDestinationIds.length < 1) {
        throw new BadRequestException('Pilih minimal 1 tujuan private tour');
      }
      if (!dto.pickup_location?.trim()) {
        throw new BadRequestException('Tempat jemput wajib diisi');
      }
      if (!dto.pickup_maps_url?.trim()) {
        throw new BadRequestException('Tag/link maps wajib diisi');
      }
      if (!this.hasPickupCoordinate(dto)) {
        throw new BadRequestException('Titik jemput di peta wajib dipilih');
      }
      durationMinutes = this.privateTourDurationMinutes(
        privateDestinationIds.length,
      );
    } else {
      throw new BadRequestException('Jenis booking tidak valid');
    }

    const slot = this.buildJakartaSlot(visitDate, pickupTime, durationMinutes);
    const availability = await this.getSlotAvailability(
      slot.start,
      slot.end,
      undefined,
      participants,
    );
    if (!availability.available) {
      throw new BadRequestException(
        `Jadwal ${dto.visit_date} ${pickupTime} sudah penuh. Kapasitas Sakoci tersedia ${availability.capacity}, terpakai ${availability.booked}.`,
      );
    }
    this.assertParticipantCapacity(
      participants,
      availability.maxParticipantsPerBooking,
    );
    const booking = await this.dataSource.transaction(async (manager) => {
      const user =
        authenticatedCustomer ??
        (await manager.save(
          User,
          manager.create(User, {
            name: groupName,
            email,
            password: await bcrypt.hash(password, 10),
            active: true,
            ...profile,
          }),
        ));

      const booking = manager.create(Booking, {
        booking_type: bookingType,
        group_name: groupName,
        tour_package_id: bookingType === 'package' ? tourPackageId : undefined,
        rental_option_id: rentalOptionId,
        visit_date: visitDate,
        participants,
        pickup_time: pickupTime,
        pickup_location: dto.pickup_location?.trim() || undefined,
        pickup_maps_url: dto.pickup_maps_url?.trim() || undefined,
        pickup_latitude: dto.pickup_latitude,
        pickup_longitude: dto.pickup_longitude,
        private_destination_ids: privateDestinationIds,
        contact_phone: dto.contact_phone?.trim() || undefined,
        contact_email: email,
        notes: dto.notes?.trim() || undefined,
        user_id: user.id,
        total_price,
        status: 'pending',
        payment_status: 'unpaid',
      });

      return manager.save(Booking, booking);
    });

    return booking;
  }

  async updateMyTravelDetails(
    id: number,
    user: AuthenticatedUser,
    dto: UpdateBookingTravelDto,
  ) {
    const booking = await this.bookingRepo.findOne({
      where: { id },
      relations: ['tour_package', 'rental_option'],
    });
    if (!booking || booking.user_id !== user.id)
      throw new NotFoundException('Booking tidak ditemukan');
    if (booking.payment_status === 'paid') {
      throw new BadRequestException(
        'Detail perjalanan tidak dapat diedit setelah pembayaran dikonfirmasi admin',
      );
    }
    if (
      ['assigned', 'in_progress', 'completed', 'cancelled'].includes(
        booking.status,
      )
    ) {
      throw new BadRequestException(
        'Detail perjalanan tidak dapat diedit dari status saat ini',
      );
    }

    const groupName = dto.group_name?.trim() || booking.group_name;
    const participants =
      dto.participants === undefined
        ? Number(booking.participants)
        : Number(dto.participants);
    if (
      !Number.isInteger(participants) ||
      participants < 1 ||
      participants > 1000
    ) {
      throw new BadRequestException('Jumlah peserta harus 1 sampai 1000');
    }

    const visitDate = dto.visit_date
      ? this.parseVisitDate(dto.visit_date)
      : this.normalizeVisitDate(booking.visit_date);
    const pickupTime = dto.pickup_time
      ? this.parsePickupTime(dto.pickup_time)
      : this.parsePickupTime(booking.pickup_time);
    let privateDestinationIds = booking.private_destination_ids;
    if (booking.booking_type === 'private') {
      privateDestinationIds = (
        dto.private_destination_ids ??
        booking.private_destination_ids ??
        []
      )
        .map(Number)
        .filter(
          (destinationId) =>
            Number.isInteger(destinationId) && destinationId > 0,
        );
      if (privateDestinationIds.length < 1)
        throw new BadRequestException('Pilih minimal 1 tujuan private tour');
    }

    const pickupLocation =
      dto.pickup_location?.trim() ?? booking.pickup_location;
    const pickupMapsUrl =
      dto.pickup_maps_url?.trim() ?? booking.pickup_maps_url;
    const pickupLatitude = dto.pickup_latitude ?? booking.pickup_latitude;
    const pickupLongitude = dto.pickup_longitude ?? booking.pickup_longitude;
    if (booking.booking_type !== 'package') {
      if (!pickupLocation?.trim())
        throw new BadRequestException('Tempat jemput wajib diisi');
      if (!pickupMapsUrl?.trim())
        throw new BadRequestException('Tag/link maps wajib diisi');
      if (pickupLatitude == null || pickupLongitude == null)
        throw new BadRequestException('Titik jemput di peta wajib dipilih');
    }

    const durationMinutes =
      booking.booking_type === 'package'
        ? this.durationHoursToMinutes(booking.tour_package?.duration_hours, 120)
        : booking.booking_type === 'private'
          ? this.privateTourDurationMinutes(
              (privateDestinationIds ?? []).length,
            )
          : 120;
    const slot = this.buildJakartaSlot(visitDate, pickupTime, durationMinutes);
    const availability = await this.getSlotAvailability(
      slot.start,
      slot.end,
      booking.id,
      participants,
    );
    if (!availability.available) {
      throw new BadRequestException(
        `Jadwal ${this.formatVisitDate(visitDate)} ${pickupTime} sudah penuh. Kapasitas Sakoci tersedia ${availability.capacity}, terpakai ${availability.booked}.`,
      );
    }
    this.assertParticipantCapacity(
      participants,
      availability.maxParticipantsPerBooking,
    );

    booking.group_name = groupName;
    booking.participants = participants;
    booking.visit_date = visitDate;
    booking.pickup_time = pickupTime;
    booking.pickup_location = pickupLocation || '';
    booking.pickup_maps_url = pickupMapsUrl || '';
    booking.pickup_latitude = pickupLatitude;
    booking.pickup_longitude = pickupLongitude;
    booking.private_destination_ids = privateDestinationIds;
    booking.contact_phone = dto.contact_phone?.trim() ?? booking.contact_phone;
    booking.notes = dto.notes?.trim() ?? booking.notes;
    if (booking.booking_type === 'package') {
      booking.total_price =
        Number(booking.tour_package?.price_per_person ?? 0) * participants;
    } else if (booking.booking_type === 'rental') {
      booking.total_price =
        Number(booking.rental_option?.base_price ?? 0) +
        Number(booking.rental_option?.price_per_person ?? 0) * participants;
    }

    await this.bookingRepo.save(booking);
    await this.auditService.record({
      actor: user,
      action: 'booking.customer_update_travel',
      entityType: 'booking',
      entityId: booking.id,
      bookingCode: `BK-${String(booking.id).padStart(3, '0')}`,
      metadata: { paymentStatus: booking.payment_status },
    });
    return this.findOneForUser(id, user);
  }

  private parseVisitDate(value?: string) {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new BadRequestException(
        'Tanggal kunjungan wajib diisi dengan format YYYY-MM-DD',
      );
    }

    const date = new Date(`${value}T00:00:00.000Z`);
    if (
      Number.isNaN(date.getTime()) ||
      date.toISOString().slice(0, 10) !== value
    ) {
      throw new BadRequestException('Tanggal kunjungan tidak valid');
    }
    if (value < this.jakartaDateKey(new Date())) {
      throw new BadRequestException(
        'Tanggal perjalanan tidak boleh tanggal lampau',
      );
    }

    return date;
  }

  private normalizeVisitDate(value?: Date | string | null) {
    if (value instanceof Date) {
      if (Number.isNaN(value.getTime())) {
        throw new BadRequestException('Tanggal kunjungan tidak valid');
      }
      return value;
    }

    if (typeof value === 'string') {
      return this.parseVisitDate(value.slice(0, 10));
    }

    throw new BadRequestException('Tanggal kunjungan tidak valid');
  }

  private formatVisitDate(value: Date | string) {
    return this.normalizeVisitDate(value).toISOString().slice(0, 10);
  }

  private parsePickupTime(value?: string) {
    const time = value?.trim();
    if (!time || !/^\d{2}:\d{2}$/.test(time)) {
      throw new BadRequestException(
        'Jam keberangkatan wajib diisi dengan format HH:mm',
      );
    }

    const [hour, minute] = time.split(':').map(Number);
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
      throw new BadRequestException('Jam keberangkatan tidak valid');
    }

    return time;
  }

  private buildJakartaSlot(
    visitDate: Date | string,
    pickupTime: string,
    durationMinutes: number,
  ) {
    const datePart = this.formatVisitDate(visitDate);
    const start = new Date(`${datePart}T${pickupTime}:00+07:00`);
    if (Number.isNaN(start.getTime())) {
      throw new BadRequestException('Jadwal keberangkatan tidak valid');
    }

    const duration = Number(durationMinutes);
    if (!Number.isInteger(duration) || duration < 1 || duration > 1440) {
      throw new BadRequestException('Durasi perjalanan tidak valid');
    }

    return {
      start,
      end: new Date(start.getTime() + duration * 60_000),
      durationMinutes: duration,
    };
  }

  private durationHoursToMinutes(value: any, fallback: number) {
    const hours = Number(value);
    if (!Number.isFinite(hours) || hours <= 0) return fallback;
    return Math.max(1, Math.round(hours * 60));
  }

  private privateTourDurationMinutes(destinationCount: number) {
    const count = Number(destinationCount);
    if (!Number.isInteger(count) || count < 1) return 120;
    return Math.max(120, count * 60);
  }

  private async resolveBookingDurationMinutes(input: {
    booking_type: 'package' | 'rental' | 'private';
    tour_package_id?: number;
    duration_minutes?: number;
    destination_count?: number;
  }) {
    if (
      Number.isInteger(input.duration_minutes) &&
      input.duration_minutes! > 0
    ) {
      return input.duration_minutes!;
    }

    if (input.booking_type === 'package') {
      const packageId = Number(input.tour_package_id);
      if (!Number.isInteger(packageId) || packageId < 1) {
        throw new BadRequestException('Pilih paket wisata yang valid');
      }
      const pkg = await this.pkgRepo.findOne({ where: { id: packageId } });
      if (!pkg || !pkg.active)
        throw new BadRequestException(
          'Paket wisata tidak valid atau tidak aktif',
        );
      return this.durationHoursToMinutes(pkg.duration_hours, 120);
    }

    if (input.booking_type === 'private') {
      return this.privateTourDurationMinutes(
        Number(input.destination_count ?? 1),
      );
    }

    return 120;
  }

  private async getSlotAvailability(
    start: Date,
    end: Date,
    excludeBookingId?: number,
    participants?: number,
  ) {
    const settings = await this.settingsService.getSettings();
    const maxParticipantsPerBooking = Number(settings.defaultCapacityLimit);
    const activeSakoci = await this.sakociRepo
      .createQueryBuilder('sakoci')
      .where('sakoci.active = true')
      .andWhere('sakoci.status NOT IN (:...statuses)', {
        statuses: ['maintenance', 'inactive'],
      })
      .getCount();

    const targetVisitDate = this.jakartaDateKey(start);

    const bookings = await this.bookingRepo.find({
      where: {
        visit_date: targetVisitDate as any,
        status: In(['pending', 'confirmed', 'assigned', 'in_progress'] as any),
      },
      relations: ['tour_package'],
    });
    const bookedBookingIds = new Set<number>();
    let bookingHolds = 0;
    for (const booking of bookings) {
      if (excludeBookingId && booking.id === excludeBookingId) continue;
      if (
        !booking.pickup_time ||
        ['rejected', 'expired', 'refunded'].includes(
          String(booking.payment_status),
        )
      )
        continue;
      const duration =
        booking.booking_type === 'package'
          ? this.durationHoursToMinutes(
              booking.tour_package?.duration_hours,
              120,
            )
          : booking.booking_type === 'private'
            ? this.privateTourDurationMinutes(
                (booking.private_destination_ids ?? []).length,
              )
            : 120;
      const slot = this.buildJakartaSlot(
        booking.visit_date,
        booking.pickup_time,
        duration,
      );
      if (this.slotsOverlap(slot.start, slot.end, start, end)) {
        bookedBookingIds.add(booking.id);
        bookingHolds += 1;
      }
    }

    const trips = await this.driverTripRepo.find({
      where: {
        trip_status: In([
          'ASSIGNED',
          'ACCEPTED',
          'EN_ROUTE_TO_PICKUP',
          'AT_PICKUP',
          'EN_ROUTE_TO_DESTINATION',
          'AT_DESTINATION',
          'EN_ROUTE_TO_ENDPOINT',
          'ISSUE_REPORTED',
        ] as any),
      },
    });
    const tripHolds = trips.filter((trip) => {
      if (bookedBookingIds.has(trip.booking_id)) return false;
      return this.slotsOverlap(
        new Date(trip.scheduled_user_pickup_at),
        new Date(trip.estimated_end_at),
        start,
        end,
      );
    }).length;

    const booked = bookingHolds + tripHolds;
    const remaining = Math.max(0, activeSakoci - booked);
    const vehicleAvailable = activeSakoci > booked;
    const participantCapacity = vehicleAvailable
      ? maxParticipantsPerBooking
      : 0;
    const participantFits =
      participants === undefined || participants <= maxParticipantsPerBooking;
    return {
      available: vehicleAvailable && participantFits,
      capacity: activeSakoci,
      booked,
      remaining,
      maxParticipantsPerBooking,
      participantCapacity,
      start: start.toISOString(),
      end: end.toISOString(),
    };
  }

  private slotsOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
    return (
      aStart.getTime() < bEnd.getTime() && aEnd.getTime() > bStart.getTime()
    );
  }

  private assertParticipantCapacity(
    participants: number,
    maxParticipantsPerBooking: number,
  ) {
    if (participants > maxParticipantsPerBooking) {
      throw new BadRequestException(
        `Jumlah peserta melebihi kapasitas Sakoci (${maxParticipantsPerBooking} orang)`,
      );
    }
  }

  private normalizeEmail(value?: string) {
    const email = value?.trim().toLowerCase();
    if (!email) return undefined;

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new BadRequestException('Format email tidak valid');
    }

    return email;
  }

  private hasPickupCoordinate(dto: CreateBookingDto) {
    const lat = Number(dto.pickup_latitude);
    const lng = Number(dto.pickup_longitude);
    return Number.isFinite(lat) && Number.isFinite(lng);
  }

  private validateIdentityProfile(dto: CreateBookingDto) {
    const nik = dto.nik?.trim();
    const birth_place = dto.birth_place?.trim();
    const birth_date = dto.birth_date?.trim();
    const domicile = dto.domicile?.trim();
    const ktp_address = dto.ktp_address?.trim();

    if (!nik) throw new BadRequestException('NIK wajib diisi');
    if (!birth_place) throw new BadRequestException('Tempat lahir wajib diisi');
    if (!birth_date || !/^\d{4}-\d{2}-\d{2}$/.test(birth_date)) {
      throw new BadRequestException(
        'Tanggal lahir wajib diisi dengan format YYYY-MM-DD',
      );
    }
    if (!domicile)
      throw new BadRequestException('Domisili saat ini wajib diisi');
    if (!ktp_address)
      throw new BadRequestException('Alamat sesuai KTP wajib diisi');

    return { nik, birth_place, birth_date, domicile, ktp_address };
  }

  async updateStatus(id: number, status: BookingStatus, notes?: string) {
    const booking = await this.findOne(id);
    const allowedStatuses: BookingStatus[] = [
      'pending',
      'confirmed',
      'assigned',
      'in_progress',
      'cancelled',
      'completed',
    ];
    if (!allowedStatuses.includes(status)) {
      throw new BadRequestException('Status booking tidak valid');
    }
    assertBookingStatusTransition(booking, status);
    await this.bookingRepo.update(id, {
      status,
      ...(notes ? { notes } : {}),
    });

    return this.findOne(id);
  }

  async getRoute(id: number) {
    await this.findOne(id);
    const route = await this.routeOptimizationRepo.findOne({
      where: { booking_id: id },
      order: { updated_at: 'DESC' },
    });

    if (!route) {
      return {
        status: 'pending',
        orderedDestinations: [],
        totalDistanceKm: 0,
        segments: [],
        evaluatedRoutes: [],
        geojson: null,
      };
    }

    return this.mapRouteOptimizationResult(route);
  }

  async getRouteForUser(id: number, user: AuthenticatedUser) {
    const booking = await this.findOne(id);
    this.assertBookingAccess(booking, user);
    const route = await this.getRoute(id);
    if (user.role === UserRole.CUSTOMER)
      return this.sanitizeRouteSnapshot(route);
    return route;
  }

  // Finalisasi memakai routingService.optimizeV2 agar cost matrix, endpoint opsional,
  // dan profil kendaraan tetap konsisten dengan preview publik.
  async finalizeRoute(
    id: number,
    user: AuthenticatedUser,
    options?: {
      force?: boolean;
      reason?: string;
      endpoint?: {
        name?: string;
        address?: string;
        latitude?: number;
        longitude?: number;
      } | null;
      vehicleProfile?: string;
    },
  ) {
    const booking = await this.findOne(id);
    this.assertBookingAccess(booking, user);
    this.assertRouteFinalizable(booking);
    const destinationIds = this.getBookingDestinationIds(booking);
    if (!this.bookingRequiresRoute(booking)) {
      return this.saveRouteOptimizationPending(
        id,
        'Booking tidak membutuhkan optimasi rute wisata',
      );
    }
    if (destinationIds.length < 2 || destinationIds.length > 8) {
      throw new BadRequestException({
        code: 'BOOKING_DESTINATION_COUNT_INVALID',
        message: 'Finalisasi rute membutuhkan 2 sampai 8 destinasi',
      });
    }
    const pickup = this.requireBookingPickup(booking);
    const activeBuild = await this.routingService.getActiveRoutingBuild();
    if (!activeBuild) {
      throw new BadRequestException({
        code: 'ROUTING_MATRIX_NOT_READY',
        message: 'Matrix routing ACTIVE belum tersedia',
      });
    }
    const endpoint = this.normalizeRouteEndpoint(options?.endpoint);
    const vehicleProfile = options?.vehicleProfile?.trim() || 'SAKOCI_DEFAULT';
    const fingerprint = this.routeFingerprint(
      booking,
      destinationIds,
      activeBuild.id,
      endpoint,
      vehicleProfile,
    );
    const existing = await this.routeOptimizationRepo.findOne({
      where: { booking_id: id },
      order: { updated_at: 'DESC' },
    });
    if (
      !options?.force &&
      existing?.route_status === 'final' &&
      existing.route_fingerprint === fingerprint
    ) {
      return this.mapRouteOptimizationResult(existing);
    }

    try {
      const result = await this.routingService.optimizeV2({
        pickup,
        destinationIds,
        useOsrm: false,
      });
      await this.saveRouteOptimizationSuccess(id, result, {
        routeStatus: 'final',
        fingerprint,
        finalizedByUserId: user.id,
        staleReason: null,
        endpoint,
        vehicleProfile,
      });
      await this.auditService.record({
        actor: user,
        action: options?.force ? 'route.reoptimize' : 'route.finalize',
        entityType: 'booking',
        entityId: id,
        bookingCode: `BK-${String(booking.id).padStart(3, '0')}`,
        metadata: {
          bookingId: id,
          destinationCount: destinationIds.length,
          routingBuildId: activeBuild.id,
        },
      });
      return this.getRoute(id);
    } catch (error: any) {
      await this.saveRouteOptimizationFailed(
        id,
        this.safeRoutingErrorMessage(error),
        {
          routeStatus: 'failed',
          fingerprint,
          finalizedByUserId: user.id,
          staleReason: options?.reason?.trim() || null,
        },
      );
      throw error;
    }
  }

  async reoptimizeRoute(
    id: number,
    user: AuthenticatedUser,
    body?: { reason?: string; mode?: string },
  ) {
    const reason = body?.reason?.trim();
    if (!reason || reason.length < 5 || reason.length > 500) {
      throw new BadRequestException(
        'Alasan optimasi ulang wajib 5-500 karakter',
      );
    }
    const booking = await this.findOne(id);
    this.assertBookingAccess(booking, user);
    if (!this.bookingRequiresRoute(booking)) {
      throw new BadRequestException(
        'Booking ini tidak membutuhkan optimasi rute',
      );
    }
    await this.markRouteStale(id, reason);
    return this.finalizeRoute(id, user, { force: true, reason });
  }

  async findAssignableStaff(role?: 'tour_guide' | 'driver') {
    const roles = role ? [role] : ['tour_guide', 'driver'];
    const staff = await this.userRepo.find({
      where: {
        active: true,
        role: { name: In(roles) },
      },
      relations: ['role'],
      order: { name: 'ASC' },
    });
    return staff.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role_id: user.role_id,
      role: user.role,
      active: user.active,
      avatar_url: user.avatar_url,
    }));
  }

  async savePaymentProof(id: number, user: AuthenticatedUser, url: string) {
    const booking = await this.findOne(id);
    this.assertBookingAccess(booking, user);
    const previousUrl =
      user.role === UserRole.CUSTOMER
        ? booking.payment_proof_url
        : booking.admin_payment_proof_url;

    if (user.role === UserRole.CUSTOMER) {
      assertBookingPayable(booking);
      booking.payment_proof_url = url;
      booking.payment_status = 'waiting_verification';
      booking.status = 'pending';
      booking.payment_rejection_reason = null;
      booking.payment_rejected_at = null;
      booking.payment_rejected_by_user_id = null;
    } else {
      booking.admin_payment_proof_url = url;
    }
    await this.bookingRepo.save(booking);
    await this.storage.deleteIfManaged(previousUrl);
    return this.findOneForUser(id, user);
  }

  async getPaymentProofFile(id: number, user: AuthenticatedUser, kind: string) {
    const booking = await this.findOne(id);
    this.assertBookingAccess(booking, user);
    if (!['customer', 'admin'].includes(kind)) {
      throw new NotFoundException('Bukti pembayaran tidak ditemukan');
    }
    if (user.role === UserRole.CUSTOMER && kind !== 'customer') {
      throw new NotFoundException('Bukti pembayaran tidak ditemukan');
    }

    const storedUrl =
      kind === 'customer'
        ? booking.payment_proof_url
        : booking.admin_payment_proof_url;
    if (!storedUrl)
      throw new NotFoundException('Bukti pembayaran tidak ditemukan');

    try {
      return await this.storage.getPrivateReadUrl(
        storedUrl,
        'booking-payments',
      );
    } catch {
      throw new NotFoundException('Bukti pembayaran tidak ditemukan');
    }
  }

  async updateAssignment(
    id: number,
    dto: {
      assigned_tour_guide_id?: number | null;
      assigned_driver_id?: number | null;
      sakoci_id?: number | null;
      vehicle_name?: string | null;
      vehicle_plate_number?: string | null;
    },
  ) {
    const booking = await this.findOne(id);
    const guideId = this.normalizeOptionalId(dto.assigned_tour_guide_id);
    const driverId = this.normalizeOptionalId(dto.assigned_driver_id);
    const sakociId = this.normalizeOptionalId(dto.sakoci_id);

    if (guideId) await this.ensureStaffRole(guideId, 'tour_guide');
    if (driverId) await this.ensureStaffRole(driverId, 'driver');
    const sakoci = sakociId ? await this.ensureActiveSakoci(sakociId) : null;

    booking.assigned_tour_guide_id = guideId ?? null;
    booking.assigned_driver_id = driverId ?? null;
    booking.sakoci_id = sakociId ?? null;
    booking.vehicle_name = dto.vehicle_name?.trim() || sakoci?.name || null;
    booking.vehicle_plate_number =
      dto.vehicle_plate_number?.trim() || sakoci?.plate_number || null;

    await this.bookingRepo.save(booking);
    return this.findOne(id);
  }

  async updatePayment(
    id: number,
    dto: {
      payment_status?: PaymentStatus;
      payment_method?: string | null;
      paid_amount?: number | null;
      payment_proof_url?: string | null;
      admin_payment_proof_url?: string | null;
      payment_notes?: string | null;
    },
  ) {
    const booking = await this.findOne(id);
    const allowedStatuses: PaymentStatus[] = [
      'unpaid',
      'waiting_verification',
      'paid',
      'rejected',
      'expired',
      'refunded',
    ];
    if (dto.payment_status && !allowedStatuses.includes(dto.payment_status)) {
      throw new BadRequestException('Status pembayaran tidak valid');
    }

    booking.payment_status = dto.payment_status ?? booking.payment_status;
    booking.payment_method = dto.payment_method?.trim() || null;
    booking.payment_proof_url =
      dto.payment_proof_url?.trim() || booking.payment_proof_url;
    booking.admin_payment_proof_url =
      dto.admin_payment_proof_url?.trim() || booking.admin_payment_proof_url;
    booking.payment_notes = dto.payment_notes?.trim() || null;

    const paidAmount =
      dto.paid_amount === null || dto.paid_amount === undefined
        ? undefined
        : Number(dto.paid_amount);
    if (paidAmount !== undefined) {
      if (!Number.isFinite(paidAmount) || paidAmount < 0) {
        throw new BadRequestException('Nominal pembayaran tidak valid');
      }
      booking.paid_amount = paidAmount;
    }

    await this.bookingRepo.save(booking);
    return this.findOne(id);
  }

  async verifyPayment(
    id: number,
    admin: AuthenticatedUser,
    dto: { paid_amount?: number | null; payment_method?: string | null },
  ) {
    await this.dataSource.transaction(async (manager) => {
      const booking = await manager.findOne(Booking, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!booking) throw new NotFoundException('Booking tidak ditemukan');
      assertPaymentVerifiable(booking);
      const paidAmount =
        dto.paid_amount === undefined || dto.paid_amount === null
          ? Number(booking.total_price ?? 0)
          : Number(dto.paid_amount);
      if (!Number.isFinite(paidAmount) || paidAmount < 0) {
        throw new BadRequestException('Nominal pembayaran tidak valid');
      }
      booking.payment_status = 'paid';
      booking.status = syncBookingStatusFromPayment('paid');
      booking.paid_amount = paidAmount;
      booking.payment_method =
        dto.payment_method?.trim() ||
        booking.payment_method ||
        'manual_transfer';
      booking.payment_verified_by_user_id = admin.id;
      booking.payment_verified_at = new Date();
      booking.payment_rejection_reason = null;
      booking.payment_rejected_at = null;
      booking.payment_rejected_by_user_id = null;
      await manager.save(Booking, booking);
    });
    await this.auditService.record({
      actor: admin,
      action: 'payment.verify',
      entityType: 'booking',
      entityId: id,
      bookingCode: `BK-${String(id).padStart(3, '0')}`,
      metadata: {
        paidAmount: dto.paid_amount ?? null,
        paymentMethod: dto.payment_method ?? null,
      },
    });
    return this.findOne(id);
  }

  async rejectPayment(
    id: number,
    admin: AuthenticatedUser,
    dto: { reason?: string },
  ) {
    const reason = dto.reason?.trim();
    if (!reason || reason.length < 5 || reason.length > 500) {
      throw new BadRequestException('Alasan penolakan wajib 5-500 karakter');
    }
    await this.dataSource.transaction(async (manager) => {
      const booking = await manager.findOne(Booking, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!booking) throw new NotFoundException('Booking tidak ditemukan');
      assertPaymentVerifiable(booking);
      booking.payment_status = 'rejected';
      booking.status = syncBookingStatusFromPayment('rejected');
      booking.payment_rejection_reason = reason;
      booking.payment_rejected_by_user_id = admin.id;
      booking.payment_rejected_at = new Date();
      await manager.save(Booking, booking);
    });
    await this.auditService.record({
      actor: admin,
      action: 'payment.reject',
      entityType: 'booking',
      entityId: id,
      bookingCode: `BK-${String(id).padStart(3, '0')}`,
      metadata: { reason },
    });
    return this.findOne(id);
  }

  async cancelBooking(
    id: number,
    user: AuthenticatedUser,
    reasonInput?: string,
  ) {
    const reason = reasonInput?.trim();
    if (!reason || reason.length < 5 || reason.length > 500) {
      throw new BadRequestException('Alasan pembatalan wajib 5-500 karakter');
    }
    const isAdmin = [UserRole.ADMIN_OPERASIONAL, UserRole.SUPER_ADMIN].includes(
      user.role,
    );
    await this.dataSource.transaction(async (manager) => {
      const booking = await manager.findOne(Booking, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!booking) throw new NotFoundException('Booking tidak ditemukan');
      if (!isAdmin && booking.user_id !== user.id)
        throw new NotFoundException('Booking tidak ditemukan');
      if (!canCancelBooking(booking, isAdmin)) {
        throw new BadRequestException(
          'Booking tidak dapat dibatalkan dari status saat ini',
        );
      }
      booking.status = 'cancelled';
      if (booking.payment_status !== 'paid') booking.payment_status = 'expired';
      booking.cancelled_at = new Date();
      booking.cancelled_by_user_id = user.id;
      booking.cancelled_by_role = user.role;
      booking.cancellation_reason = reason;
      booking.assigned_driver_id = null;
      booking.assigned_tour_guide_id = null;
      booking.sakoci_id = null;
      booking.vehicle_name = null;
      booking.vehicle_plate_number = null;
      await manager.save(Booking, booking);
      const trip = await manager.findOne(DriverTrip, {
        where: { booking_id: id },
        lock: { mode: 'pessimistic_write' },
      });
      if (trip && !['COMPLETED', 'CANCELLED'].includes(trip.trip_status)) {
        if (!['ASSIGNED', 'ACCEPTED'].includes(trip.trip_status)) {
          throw new BadRequestException(
            'Booking yang sudah berjalan tidak dapat dibatalkan',
          );
        }
        trip.trip_status = 'CANCELLED';
        trip.cancelled_at = new Date();
        trip.cancellation_reason = reason;
        trip.tracking_active = false;
        trip.tracking_ended_at = new Date();
        await manager.save(DriverTrip, trip);
        const sakoci = await manager.findOne(Sakoci, {
          where: { id: trip.sakoci_id },
        });
        if (sakoci?.active && sakoci.status !== 'maintenance') {
          await manager.update(Sakoci, trip.sakoci_id, { status: 'available' });
        }
      }
    });
    await this.auditService.record({
      actor: user,
      action: 'booking.cancel',
      entityType: 'booking',
      entityId: id,
      bookingCode: `BK-${String(id).padStart(3, '0')}`,
      metadata: { reason, byAdmin: isAdmin },
    });
    return this.findOneForUser(id, user);
  }

  async updateVehicleLocation(
    id: number,
    dto: {
      latitude?: number;
      longitude?: number;
    },
  ) {
    const booking = await this.findOne(id);
    const lat = Number(dto.latitude);
    const lng = Number(dto.longitude);
    if (
      !Number.isFinite(lat) ||
      lat < -90 ||
      lat > 90 ||
      !Number.isFinite(lng) ||
      lng < -180 ||
      lng > 180
    ) {
      throw new BadRequestException('Koordinat kendaraan tidak valid');
    }

    booking.vehicle_latitude = lat;
    booking.vehicle_longitude = lng;
    booking.vehicle_location_updated_at = new Date();
    await this.bookingRepo.save(booking);
    if (booking.sakoci_id) {
      await this.sakociRepo.update(booking.sakoci_id, {
        latitude: lat,
        longitude: lng,
        location_updated_at: booking.vehicle_location_updated_at,
      });
    }
    return this.findOne(id);
  }

  private normalizeOptionalId(value?: number | null) {
    if (value === null || value === undefined || value === 0) return undefined;
    const id = Number(value);
    if (!Number.isInteger(id) || id < 1) {
      throw new BadRequestException('ID petugas tidak valid');
    }
    return id;
  }

  private async ensureStaffRole(id: number, roleName: 'tour_guide' | 'driver') {
    const staff = await this.userRepo.findOne({
      where: { id },
      relations: ['role'],
    });
    if (!staff || !staff.active || staff.role?.name !== roleName) {
      throw new BadRequestException(
        roleName === 'tour_guide'
          ? 'Tour guide tidak valid'
          : 'Driver tidak valid',
      );
    }
  }

  private async ensureActiveSakoci(id: number) {
    const sakoci = await this.sakociRepo.findOne({ where: { id } });
    if (!sakoci || !sakoci.active) {
      throw new BadRequestException(
        'Sakoci tidak valid atau sedang tidak aktif',
      );
    }
    return sakoci;
  }

  private applyTrackingVisibility(
    booking: Booking,
    audience: 'user' | 'admin' | 'public',
  ) {
    const sakoci = booking.sakoci;
    const canSeeTracking =
      audience === 'admin' ||
      Boolean(
        sakoci &&
        sakoci.active &&
        sakoci.tracking_enabled &&
        (sakoci.tracking_visibility === 'public' ||
          (audience === 'user' && sakoci.tracking_visibility === 'user')),
      );

    if (!canSeeTracking) {
      booking.vehicle_latitude = null;
      booking.vehicle_longitude = null;
      booking.vehicle_location_updated_at = null;
      if (booking.sakoci) {
        booking.sakoci.latitude = null;
        booking.sakoci.longitude = null;
        booking.sakoci.location_updated_at = null;
      }
    }

    return booking;
  }

  private sanitizeCustomerBooking(booking: Booking) {
    this.applyTrackingVisibility(booking, 'user');
    const publicStaff = (staff?: User | null) =>
      staff
        ? { id: staff.id, name: staff.name, avatar_url: staff.avatar_url }
        : null;
    (booking as any).driver = publicStaff(booking.driver);
    (booking as any).tour_guide = publicStaff(booking.tour_guide);
    return booking;
  }

  private async optimizeRouteForBooking(id: number) {
    const booking = await this.findOne(id);
    const destinationIds = this.getBookingDestinationIds(booking);
    const pickupLatitude = Number(booking.pickup_latitude);
    const pickupLongitude = Number(booking.pickup_longitude);

    if (destinationIds.length < 1) {
      await this.saveRouteOptimizationPending(
        id,
        'Booking belum memiliki destinasi untuk optimasi rute',
      );
      return;
    }

    if (!Number.isFinite(pickupLatitude) || !Number.isFinite(pickupLongitude)) {
      await this.saveRouteOptimizationPending(
        id,
        'Booking belum memiliki titik jemput untuk optimasi rute',
      );
      return;
    }

    try {
      const result = await this.routingService.optimizeV2({
        pickupLatitude,
        pickupLongitude,
        destinationIds,
        useOsrm: false,
      });

      await this.saveRouteOptimizationSuccess(id, result);
    } catch (err: any) {
      await this.saveRouteOptimizationFailed(
        id,
        err?.message ?? 'Route optimization failed',
      );
    }
  }

  private async tryOptimizeRouteForBooking(id: number) {
    try {
      await this.optimizeRouteForBooking(id);
    } catch (err: any) {
      this.logger.warn(
        `Route optimization skipped for booking #${id}: ${err?.message ?? err}`,
      );
    }
  }

  private getBookingDestinationIds(booking: Booking): number[] {
    if (booking.booking_type === 'private') {
      return (booking.private_destination_ids ?? [])
        .map(Number)
        .filter((id) => Number.isInteger(id) && id > 0);
    }

    if (booking.booking_type === 'package') {
      return (booking.tour_package?.routes ?? [])
        .filter(Boolean) // Filter out any null/undefined routes
        .sort((a, b) => a.sequence - b.sequence)
        .map((route) => Number(route.heritage_site_id))
        .filter((id) => Number.isInteger(id) && id > 0);
    }

    return [];
  }

  private bookingRequiresRoute(booking: Booking) {
    if (booking.booking_type === 'rental') return false;
    return this.getBookingDestinationIds(booking).length >= 2;
  }

  private assertRouteFinalizable(booking: Booking) {
    if (booking.payment_status !== 'paid') {
      throw new BadRequestException({
        code: 'BOOKING_PAYMENT_NOT_PAID',
        message:
          'Rute hanya dapat difinalisasi setelah pembayaran terverifikasi',
      });
    }
    if (['cancelled', 'completed', 'in_progress'].includes(booking.status)) {
      throw new BadRequestException({
        code: 'BOOKING_ROUTE_NOT_FINALIZABLE',
        message: 'Status booking tidak dapat difinalisasi rutenya',
      });
    }
  }

  private requireBookingPickup(booking: Booking) {
    const latitude = Number(booking.pickup_latitude);
    const longitude = Number(booking.pickup_longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      throw new BadRequestException({
        code: 'BOOKING_PICKUP_REQUIRED',
        message: 'Titik jemput booking belum valid',
      });
    }
    return { latitude, longitude };
  }

  private routeFingerprint(
    booking: Booking,
    destinationIds: number[],
    routingBuildId: string,
    endpoint: {
      name: string;
      address: string | null;
      latitude: number | null;
      longitude: number | null;
    } | null,
    vehicleProfile: string,
  ) {
    const pickup = this.requireBookingPickup(booking);
    const payload = {
      bookingType: booking.booking_type,
      pickup: {
        latitude: Number(pickup.latitude.toFixed(7)),
        longitude: Number(pickup.longitude.toFixed(7)),
      },
      destinationIds,
      routingBuildId,
      endpoint,
      vehicleProfile,
      accessRules: {
        vehicleAccessible: true,
        sakociAllowed: true,
      },
    };
    return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  }

  private normalizeRouteEndpoint(
    endpoint?: {
      name?: string;
      address?: string;
      latitude?: number;
      longitude?: number;
    } | null,
  ) {
    const name = endpoint?.name?.trim();
    if (!name) return null;
    const endpointValue = endpoint!;
    const latitude =
      endpointValue.latitude === undefined
        ? null
        : Number(endpointValue.latitude);
    const longitude =
      endpointValue.longitude === undefined
        ? null
        : Number(endpointValue.longitude);
    return {
      name,
      address: endpointValue.address?.trim() || null,
      latitude: Number.isFinite(latitude) ? latitude : null,
      longitude: Number.isFinite(longitude) ? longitude : null,
    };
  }

  async markRouteStale(id: number, reason: string) {
    const existing = await this.routeOptimizationRepo.findOne({
      where: { booking_id: id },
      order: { updated_at: 'DESC' },
    });
    if (!existing || existing.route_status !== 'final') return;
    existing.route_status = 'stale';
    existing.stale_reason = reason;
    await this.routeOptimizationRepo.save(existing);
  }

  private sanitizeRouteSnapshot(route: any) {
    const sanitizeSegment = (segment: any) => {
      if (!segment || typeof segment !== 'object') return segment;
      const { edgeSteps, pathNodeIds, alternatives, ...safe } = segment;
      return safe;
    };
    return {
      ...route,
      evaluatedRoutes: [],
      segments: (route.segments ?? []).map(sanitizeSegment),
    };
  }

  private safeRoutingErrorMessage(error: any) {
    const response =
      typeof error?.getResponse === 'function' ? error.getResponse() : null;
    if (response && typeof response === 'object' && 'message' in response) {
      return String(response.message);
    }
    return error?.message ?? 'Finalisasi rute gagal';
  }

  private async saveRouteOptimizationPending(
    bookingId: number,
    message: string,
  ) {
    return this.upsertRouteOptimizationResult({
      booking_id: bookingId,
      status: 'pending',
      algorithm: null,
      ordered_destination_ids: [],
      total_distance_km: 0,
      total_duration_minutes: null,
      segments: [],
      evaluated_routes: [],
      osrm_geometry: null,
      route_geojson: null,
      route_source: null,
      route_status: 'pending',
      route_fingerprint: null,
      routing_build_id: null,
      finalized_at: null,
      finalized_by_user_id: null,
      stale_reason: null,
      route_summary: null,
      error_message: message,
    });
  }

  private async saveRouteOptimizationFailed(
    bookingId: number,
    message: string,
    options?: {
      routeStatus?: 'failed' | 'stale';
      fingerprint?: string;
      finalizedByUserId?: number;
      staleReason?: string | null;
      endpoint?: any;
      vehicleProfile?: string;
    },
  ) {
    await this.upsertRouteOptimizationResult({
      booking_id: bookingId,
      status: 'failed',
      algorithm: null,
      ordered_destination_ids: [],
      total_distance_km: 0,
      total_duration_minutes: null,
      segments: [],
      evaluated_routes: [],
      osrm_geometry: null,
      route_geojson: null,
      route_source: null,
      route_status: options?.routeStatus ?? 'failed',
      route_fingerprint: options?.fingerprint ?? null,
      routing_build_id: null,
      finalized_at: null,
      finalized_by_user_id: options?.finalizedByUserId ?? null,
      stale_reason: options?.staleReason ?? null,
      route_summary: null,
      error_message: message,
    });
  }

  private async saveRouteOptimizationSuccess(
    bookingId: number,
    result: any,
    options?: {
      routeStatus?: 'final';
      fingerprint?: string;
      finalizedByUserId?: number;
      staleReason?: string | null;
      endpoint?: any;
      vehicleProfile?: string;
    },
  ) {
    const routeNodeIds = this.mergeRouteIds(
      result.segments ?? [],
      'pathNodeIds',
    );
    const routeEdgeIds = this.mergeRouteIds(
      result.segments ?? [],
      'pathEdgeIds',
    );
    const safeSegments = (result.segments ?? []).map((segment: any) => {
      const { edgeSteps, pathNodeIds, pathEdgeIds, alternatives, ...safe } =
        segment;
      return safe;
    });
    const saved = await this.upsertRouteOptimizationResult({
      booking_id: bookingId,
      status: 'success',
      algorithm: result.algorithm,
      ordered_destination_ids: (result.orderedDestinations ?? []).map(
        (destination: any) => destination.id,
      ),
      total_distance_km: result.totalDistanceKm,
      total_duration_minutes:
        result.totalDurationMinutes ?? result.osrm?.durationMinutes ?? null,
      segments: safeSegments,
      evaluated_routes: [],
      osrm_geometry: result.geojson ?? null,
      route_geojson: result.routeGeojson ?? result.geojson ?? null,
      route_node_ids: routeNodeIds,
      route_edge_ids: routeEdgeIds,
      route_source: result.routeSource ?? 'DIJKSTRA_GRAPH_CACHE',
      route_status: options?.routeStatus ?? 'final',
      route_fingerprint: options?.fingerprint ?? null,
      routing_build_id: result.activeRoutingBuildId ?? null,
      finalized_at: new Date(),
      finalized_by_user_id: options?.finalizedByUserId ?? null,
      stale_reason: options?.staleReason ?? null,
      route_summary: {
        orderedDestinationIds: result.orderedDestinationIds ?? [],
        totalDistanceKm: result.totalDistanceKm,
        totalDurationMinutes: result.totalDurationMinutes ?? null,
        routeSource: result.routeSource ?? 'DIJKSTRA_GRAPH_CACHE',
        routingBuildId: result.activeRoutingBuildId ?? null,
        endpoint: options?.endpoint ?? null,
        vehicleProfile: options?.vehicleProfile ?? 'SAKOCI_DEFAULT',
      },
      error_message: null,
    });
    await this.saveRouteOptimizationGeometry(saved.id);
  }

  private async upsertRouteOptimizationResult(
    data: Partial<RouteOptimizationResult> & { booking_id: number },
  ) {
    const existing = await this.routeOptimizationRepo.findOne({
      where: { booking_id: data.booking_id },
    });
    const entity = existing
      ? this.routeOptimizationRepo.merge(existing, data)
      : this.routeOptimizationRepo.create(data);

    return this.routeOptimizationRepo.save(entity);
  }

  private async saveRouteOptimizationGeometry(routeOptimizationId: number) {
    await this.dataSource.query(
      `
        UPDATE "route_optimization_result"
        SET "route_geometry" = ST_SetSRID(
          ST_GeomFromGeoJSON(("route_geojson"->'features'->0->'geometry')::text),
          4326
        )
        WHERE "id" = $1
          AND "route_geojson" IS NOT NULL
          AND jsonb_typeof("route_geojson"->'features') = 'array'
          AND jsonb_array_length("route_geojson"->'features') > 0
          AND "route_geojson"->'features'->0->'geometry'->>'type' = 'LineString'
      `,
      [routeOptimizationId],
    );
  }

  private mergeRouteIds(segments: any[], key: 'pathNodeIds' | 'pathEdgeIds') {
    const merged: number[] = [];
    for (const segment of segments) {
      const ids = (segment?.[key] ?? [])
        .map(Number)
        .filter((id: number) => Number.isInteger(id) && id > 0);
      for (const id of ids) {
        if (merged[merged.length - 1] === id) continue;
        merged.push(id);
      }
    }
    return merged;
  }

  private mapRouteOptimizationResult(route: RouteOptimizationResult) {
    return {
      status: route.status,
      algorithm: route.algorithm,
      orderedDestinationIds: route.ordered_destination_ids ?? [],
      totalDistanceKm: Number(route.total_distance_km ?? 0),
      totalDurationMinutes:
        route.total_duration_minutes === null
          ? null
          : Number(route.total_duration_minutes),
      segments: route.segments ?? [],
      evaluatedRoutes: route.evaluated_routes ?? [],
      geojson: route.route_geojson ?? route.osrm_geometry,
      routeSource: route.route_source,
      routeStatus: route.route_status,
      routeFingerprint: route.route_fingerprint,
      routingBuildId: route.routing_build_id,
      finalizedAt: route.finalized_at,
      finalizedByUserId: route.finalized_by_user_id,
      staleReason: route.stale_reason,
      routeSummary: route.route_summary,
      errorMessage: route.error_message,
      updatedAt: route.updated_at,
    };
  }

  async getStats() {
    const total = await this.bookingRepo.count();
    const pending = await this.bookingRepo.count({
      where: { status: 'pending' },
    });
    const confirmed = await this.bookingRepo.count({
      where: { status: 'confirmed' },
    });
    const completed = await this.bookingRepo.count({
      where: { status: 'completed' },
    });
    const cancelled = await this.bookingRepo.count({
      where: { status: 'cancelled' },
    });

    const revenue = await this.bookingRepo
      .createQueryBuilder('b')
      .select('SUM(b.total_price)', 'total')
      .where("b.status IN ('confirmed','completed')")
      .getRawOne();

    const monthly = await this.bookingRepo
      .createQueryBuilder('b')
      .select("TO_CHAR(b.visit_date,'YYYY-MM')", 'month')
      .addSelect('COUNT(*)', 'count')
      .addSelect('SUM(b.participants)', 'visitors')
      .groupBy("TO_CHAR(b.visit_date,'YYYY-MM')")
      .orderBy('month', 'DESC')
      .limit(12)
      .getRawMany();

    return {
      total,
      pending,
      confirmed,
      completed,
      cancelled,
      revenue: revenue?.total ?? 0,
      monthly,
    };
  }

  async getAdminDashboardSummary(period: '7d' | '30d' | 'month' = '7d') {
    const now = new Date();
    const jakartaToday = this.jakartaDateKey(now);
    const start =
      period === 'month'
        ? new Date(`${jakartaToday.slice(0, 7)}-01T00:00:00+07:00`)
        : new Date(
            now.getTime() - (period === '30d' ? 29 : 6) * 24 * 60 * 60_000,
          );
    const end = new Date(now.getTime() + 24 * 60 * 60_000);

    const [
      bookingsToday,
      pendingPayments,
      readyAssignment,
      activeTrips,
      completedToday,
      openIncidents,
      paymentQueue,
      assignmentQueue,
      departureQueue,
      incidentQueue,
      statusRows,
      trendRows,
      packageRows,
    ] = await Promise.all([
      this.bookingRepo
        .createQueryBuilder('b')
        .where(
          "TO_CHAR(b.created_at AT TIME ZONE 'Asia/Jakarta','YYYY-MM-DD') = :today",
          { today: jakartaToday },
        )
        .getCount(),
      this.bookingRepo.count({
        where: { payment_status: 'waiting_verification' },
      }),
      this.bookingRepo.count({
        where: { payment_status: 'paid', status: 'confirmed' },
      }),
      this.driverTripRepo.count({
        where: {
          trip_status: In([
            'ACCEPTED',
            'EN_ROUTE_TO_PICKUP',
            'AT_PICKUP',
            'EN_ROUTE_TO_DESTINATION',
            'AT_DESTINATION',
            'EN_ROUTE_TO_ENDPOINT',
            'ISSUE_REPORTED',
          ] as any),
        },
      }),
      this.driverTripRepo
        .createQueryBuilder('trip')
        .where("trip.trip_status = 'COMPLETED'")
        .andWhere(
          "TO_CHAR(trip.completed_at AT TIME ZONE 'Asia/Jakarta','YYYY-MM-DD') = :today",
          { today: jakartaToday },
        )
        .getCount(),
      this.tripIncidentRepo.count({
        where: { status: In(['OPEN', 'IN_REVIEW'] as any) },
      }),
      this.bookingRepo.find({
        where: { payment_status: 'waiting_verification' },
        order: { created_at: 'ASC' },
        take: 8,
        relations: ['tour_package'],
      }),
      this.bookingRepo.find({
        where: { payment_status: 'paid', status: 'confirmed' },
        order: { visit_date: 'ASC', created_at: 'ASC' },
        take: 8,
        relations: ['tour_package', 'rental_option'],
      }),
      this.driverTripRepo.find({
        where: { trip_status: In(['ASSIGNED', 'ACCEPTED'] as any) },
        order: { scheduled_user_pickup_at: 'ASC' },
        take: 8,
        relations: ['booking', 'driver', 'tour_guide', 'sakoci'],
      }),
      this.tripIncidentRepo.find({
        where: { status: In(['OPEN', 'IN_REVIEW'] as any) },
        order: { reported_at: 'DESC' },
        take: 8,
      }),
      this.bookingRepo
        .createQueryBuilder('b')
        .select('b.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .groupBy('b.status')
        .getRawMany(),
      this.bookingRepo
        .createQueryBuilder('b')
        .select(
          "TO_CHAR(b.created_at AT TIME ZONE 'Asia/Jakarta','YYYY-MM-DD')",
          'date',
        )
        .addSelect('COUNT(*)', 'count')
        .where('b.created_at >= :start', { start })
        .andWhere('b.created_at < :end', { end })
        .groupBy(
          "TO_CHAR(b.created_at AT TIME ZONE 'Asia/Jakarta','YYYY-MM-DD')",
        )
        .orderBy('date', 'ASC')
        .getRawMany(),
      this.bookingRepo
        .createQueryBuilder('b')
        .leftJoin('b.tour_package', 'package')
        .select('COALESCE(package.name, b.booking_type)', 'name')
        .addSelect('COUNT(*)', 'count')
        .where('b.created_at >= :start', { start })
        .andWhere('b.created_at < :end', { end })
        .groupBy('COALESCE(package.name, b.booking_type)')
        .orderBy('count', 'DESC')
        .limit(5)
        .getRawMany(),
    ]);

    const bookingCode = (booking: Booking) =>
      `BK-${String(booking.id).padStart(3, '0')}`;
    return {
      period,
      cards: {
        bookingsToday,
        pendingPayments,
        readyAssignment,
        activeTrips,
        completedToday,
        openIncidents,
      },
      queues: {
        pendingPayments: paymentQueue.map((booking) => ({
          id: booking.id,
          code: bookingCode(booking),
          group_name: booking.group_name,
          amount: Number(booking.total_price ?? 0),
          created_at: booking.created_at,
          href: `/admin/payments?booking=${booking.id}`,
        })),
        readyAssignment: assignmentQueue.map((booking) => ({
          id: booking.id,
          code: bookingCode(booking),
          group_name: booking.group_name,
          visit_date: booking.visit_date,
          pickup_time: booking.pickup_time,
          href: `/admin/booking/${booking.id}`,
        })),
        upcomingDepartures: departureQueue.map((trip) => ({
          id: trip.id,
          booking_id: trip.booking_id,
          code: trip.booking_reference,
          scheduled_user_pickup_at: trip.scheduled_user_pickup_at,
          missing: {
            driver: !trip.driver_id,
            guide: !trip.tour_guide_id,
            sakoci: !trip.sakoci_id,
          },
          href: `/admin/booking/${trip.booking_id}`,
        })),
        activeIncidents: incidentQueue.map((incident) => ({
          id: incident.id,
          trip_id: incident.trip_id,
          issue_type: incident.issue_type,
          status: incident.status,
          reported_at: incident.reported_at,
          href: `/admin/monitoring`,
        })),
      },
      charts: {
        bookingTrend: trendRows.map((row) => ({
          date: row.date,
          count: Number(row.count),
        })),
        statusDistribution: statusRows.map((row) => ({
          status: row.status,
          count: Number(row.count),
        })),
        popularPackages: packageRows.map((row) => ({
          name: row.name,
          count: Number(row.count),
        })),
      },
      alerts: [
        ...(pendingPayments
          ? [
              {
                type: 'payment_pending',
                count: pendingPayments,
                href: '/admin/payments',
              },
            ]
          : []),
        ...(readyAssignment
          ? [
              {
                type: 'assignment_ready',
                count: readyAssignment,
                href: '/admin/booking?status=confirmed',
              },
            ]
          : []),
        ...(activeTrips
          ? [
              {
                type: 'trip_active',
                count: activeTrips,
                href: '/admin/monitoring',
              },
            ]
          : []),
        ...(openIncidents
          ? [
              {
                type: 'incident_open',
                count: openIncidents,
                href: '/admin/monitoring',
              },
            ]
          : []),
      ],
    };
  }

  private jakartaDateKey(date: Date) {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
    }).format(date);
  }
}
