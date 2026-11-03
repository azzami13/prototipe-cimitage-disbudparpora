import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DriverTrip } from '../../common/entities/driver-trip.entity';
import {
  Sakoci,
  SakociStatus,
  SakociTrackingVisibility,
} from '../../common/entities/sakoci.entity';
import { ACTIVE_TRIP_STATUSES } from '../booking/booking-status.service';
import { SettingsService } from '../operations/services/settings.service';
import { CreateSakociDto } from './dto/create-sakoci.dto';
import { UpdateSakociDto } from './dto/update-sakoci.dto';

const STATUSES: SakociStatus[] = [
  'available',
  'assigned',
  'maintenance',
  'inactive',
];
const VISIBILITIES: SakociTrackingVisibility[] = [
  'public',
  'user',
  'admin',
  'hidden',
];

@Injectable()
export class SakociService {
  constructor(
    @InjectRepository(Sakoci)
    private readonly repo: Repository<Sakoci>,
    @InjectRepository(DriverTrip)
    private readonly tripRepo: Repository<DriverTrip>,
    private readonly settings: SettingsService,
  ) {}

  async findAll(filter?: { active?: boolean; publicOnly?: boolean }) {
    const where: any = {};
    if (filter?.active !== undefined) where.active = filter.active;
    if (filter?.publicOnly) {
      where.active = true;
      where.tracking_enabled = true;
      where.tracking_visibility = 'public';
    }

    const sakoci = await this.repo.find({
      where,
      order: { created_at: 'DESC' },
    });
    if (!filter?.publicOnly) return sakoci;

    const settings = await this.settings.getSettings();
    const activeTrips = sakoci.length
      ? await this.tripRepo
          .createQueryBuilder('trip')
          .where('trip.sakoci_id IN (:...sakociIds)', {
            sakociIds: sakoci.map((item) => item.id),
          })
          .andWhere('trip.trip_status IN (:...statuses)', {
            statuses: ACTIVE_TRIP_STATUSES,
          })
          .orderBy('trip.updated_at', 'DESC')
          .getMany()
      : [];
    const activeTripBySakociId = new Map<number, DriverTrip>();
    for (const trip of activeTrips) {
      if (!activeTripBySakociId.has(trip.sakoci_id))
        activeTripBySakociId.set(trip.sakoci_id, trip);
    }

    return sakoci.map((item) => ({
      id: item.id,
      name: item.name,
      code: item.code,
      plate_number: item.plate_number,
      image_url: item.image_url,
      status: item.status,
      latitude: item.latitude,
      longitude: item.longitude,
      location_updated_at: item.location_updated_at,
      activeTripId: activeTripBySakociId.get(item.id)?.id ?? null,
      showPublicCurrentRoute: settings.showPublicCurrentRoute,
      showSakociGraphRadius: settings.showSakociGraphRadius,
    }));
  }

  async findOne(id: number) {
    const sakoci = await this.repo.findOne({ where: { id } });
    if (!sakoci) throw new NotFoundException(`Sakoci #${id} tidak ditemukan`);
    return sakoci;
  }

  async create(dto: CreateSakociDto) {
    const data = this.normalize(dto);
    return this.repo.save(this.repo.create(data));
  }

  async update(id: number, dto: UpdateSakociDto) {
    await this.findOne(id);
    await this.repo.update(id, this.normalize(dto, true));
    return this.findOne(id);
  }

  async updateLocation(
    id: number,
    dto: { latitude?: number; longitude?: number },
  ) {
    const sakoci = await this.findOne(id);
    const { latitude, longitude } = this.normalizeCoordinate(
      dto.latitude,
      dto.longitude,
    );
    sakoci.latitude = latitude;
    sakoci.longitude = longitude;
    sakoci.location_updated_at = new Date();
    return this.repo.save(sakoci);
  }

  async remove(id: number) {
    const sakoci = await this.findOne(id);
    await this.repo.remove(sakoci);
    return { message: `Sakoci "${sakoci.name}" berhasil dihapus` };
  }

  private normalize(dto: CreateSakociDto | UpdateSakociDto, partial = false) {
    const name = dto.name?.trim();
    if (!partial && !name)
      throw new BadRequestException('Nama Sakoci wajib diisi');
    if (dto.status && !STATUSES.includes(dto.status)) {
      throw new BadRequestException('Status Sakoci tidak valid');
    }
    if (
      dto.tracking_visibility &&
      !VISIBILITIES.includes(dto.tracking_visibility)
    ) {
      throw new BadRequestException('Visibilitas tracking tidak valid');
    }

    const data: Partial<Sakoci> = {};
    if (name) data.name = name;
    if (dto.code !== undefined) data.code = dto.code?.trim() || null;
    if (dto.plate_number !== undefined)
      data.plate_number = dto.plate_number?.trim() || null;
    if (dto.image_url !== undefined)
      data.image_url = dto.image_url?.trim() || null;
    if (dto.status !== undefined || !partial)
      data.status = dto.status ?? 'available';
    if (dto.active !== undefined || !partial) data.active = dto.active ?? true;
    if (dto.tracking_enabled !== undefined || !partial)
      data.tracking_enabled = dto.tracking_enabled ?? true;
    if (dto.tracking_visibility !== undefined || !partial) {
      data.tracking_visibility = dto.tracking_visibility ?? 'admin';
    }
    if (dto.notes !== undefined) data.notes = dto.notes?.trim() || null;

    if (dto.latitude !== undefined || dto.longitude !== undefined) {
      const coordinate = this.normalizeCoordinate(dto.latitude, dto.longitude);
      data.latitude = coordinate.latitude;
      data.longitude = coordinate.longitude;
      data.location_updated_at = new Date();
    }

    return data;
  }

  private normalizeCoordinate(
    latitude?: number | null,
    longitude?: number | null,
  ) {
    const lat = Number(latitude);
    const lng = Number(longitude);
    if (
      !Number.isFinite(lat) ||
      lat < -90 ||
      lat > 90 ||
      !Number.isFinite(lng) ||
      lng < -180 ||
      lng > 180
    ) {
      throw new BadRequestException('Koordinat Sakoci tidak valid');
    }
    return { latitude: lat, longitude: lng };
  }
}
