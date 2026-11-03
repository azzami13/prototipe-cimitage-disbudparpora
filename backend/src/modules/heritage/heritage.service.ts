import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HeritageSite } from '../../common/entities/heritage-site.entity';
import { PackageRoute } from '../../common/entities/package-route.entity';
import { CreateHeritageDto } from './dto/create-heritage.dto';
import { UpdateHeritageDto } from './dto/update-heritage.dto';

export interface HeritageFindAllQuery {
  category?: string;
  kecamatan?: string;
  search?: string;
  status?: string;
  latitude?: number;
  longitude?: number;
  sort?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class HeritageService {
  constructor(
    @InjectRepository(HeritageSite)
    private readonly repo: Repository<HeritageSite>,
    @InjectRepository(PackageRoute)
    private readonly routeRepo: Repository<PackageRoute>,
  ) {}

  async findAll(query: HeritageFindAllQuery = {}) {
    const {
      category,
      kecamatan,
      search,
      status,
      latitude,
      longitude,
      sort,
      page = 1,
      limit = 15,
    } = query;
    const pageNumber = Math.max(1, Number(page) || 1);
    const limitNumber = Math.min(100, Math.max(1, Number(limit) || 15));
    const hasNearbySort =
      sort === 'nearest' &&
      Number.isFinite(latitude) &&
      Number.isFinite(longitude) &&
      latitude! >= -90 &&
      latitude! <= 90 &&
      longitude! >= -180 &&
      longitude! <= 180;

    const qb = this.repo.createQueryBuilder('hs');

    if (category) {
      qb.andWhere('hs.category = :category', { category });
    }
    if (kecamatan) {
      qb.andWhere('hs.kecamatan ILIKE :kecamatan', {
        kecamatan: `%${kecamatan}%`,
      });
    }
    if (status) {
      qb.andWhere('hs.status = :status', { status });
    }
    if (search) {
      // Cari di name ATAU address
      qb.andWhere(
        '(hs.name ILIKE :search OR hs.address ILIKE :search OR hs.no_register ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (hasNearbySort) {
      qb.andWhere('hs.latitude IS NOT NULL')
        .andWhere('hs.longitude IS NOT NULL')
        .addSelect(
          `
          6371 * acos(
            LEAST(1, GREATEST(-1,
              cos(radians(:userLatitude))
              * cos(radians(hs.latitude::double precision))
              * cos(radians(hs.longitude::double precision) - radians(:userLongitude))
              + sin(radians(:userLatitude))
              * sin(radians(hs.latitude::double precision))
            ))
          )
          `,
          'distance_km',
        )
        .setParameters({
          userLatitude: latitude,
          userLongitude: longitude,
        })
        .orderBy('distance_km', 'ASC')
        .addOrderBy('hs.name', 'ASC');
    } else {
      qb.orderBy('hs.name', 'ASC');
    }

    const total = await qb.clone().getCount();
    const { entities, raw } = await qb
      .skip((pageNumber - 1) * limitNumber)
      .take(limitNumber)
      .getRawAndEntities();

    const distanceById = new Map<number, number>();
    raw.forEach((row) => {
      const id = Number(row.hs_id);
      const distance = Number(row.distance_km);
      if (Number.isFinite(id) && Number.isFinite(distance)) {
        distanceById.set(id, Number(distance.toFixed(3)));
      }
    });

    const data = entities.map((site) => ({
      ...site,
      ...(distanceById.has(site.id)
        ? { distance_km: distanceById.get(site.id) }
        : {}),
    }));

    return {
      data,
      total,
      page: pageNumber,
      limit: limitNumber,
      totalPages: Math.ceil(total / limitNumber),
      sort: hasNearbySort ? 'nearest' : undefined,
    };
  }

  async findAllGeoJson() {
    const sites = await this.repo
      .createQueryBuilder('hs')
      .where('hs.status = :status', { status: 'aktif' })
      .andWhere('hs.latitude IS NOT NULL')
      .andWhere('hs.longitude IS NOT NULL')
      .getMany();

    return {
      type: 'FeatureCollection',
      features: sites.map((s) => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [Number(s.longitude), Number(s.latitude)],
        },
        properties: {
          id: s.id,
          name: s.name,
          category: s.category,
          address: s.address,
          kelurahan: s.kelurahan,
          kecamatan: s.kecamatan,
          status: s.status,
          image_url: s.image_url,
          no_register: s.no_register,
          description: s.description?.substring(0, 200) ?? null,
        },
      })),
    };
  }

  async findOne(id: number) {
    const site = await this.repo.findOne({ where: { id } });
    if (!site)
      throw new NotFoundException(`Heritage site #${id} tidak ditemukan`);
    return site;
  }

  async create(dto: CreateHeritageDto) {
    const site = this.repo.create(dto as any);
    return this.repo.save(site);
  }

  async update(id: number, dto: UpdateHeritageDto) {
    await this.findOne(id);
    await this.repo.update(id, dto);
    return this.findOne(id);
  }

  async remove(id: number) {
    const site = await this.findOne(id);
    const routeCount = await this.routeRepo.count({
      where: { heritage_site_id: id },
    });
    if (routeCount > 0) {
      throw new ConflictException(
        `Situs "${site.name}" tidak bisa dihapus karena masih digunakan di ${routeCount} rute paket wisata. Hapus situs ini dari rute paket terlebih dahulu.`,
      );
    }

    await this.repo.remove(site);
    return { message: `Situs "${site.name}" berhasil dihapus` };
  }

  async getStatsByCategory() {
    return this.repo
      .createQueryBuilder('hs')
      .select('hs.category', 'category')
      .addSelect('COUNT(*)', 'count')
      .groupBy('hs.category')
      .orderBy('count', 'DESC')
      .getRawMany();
  }

  async getStatsByKecamatan() {
    return this.repo
      .createQueryBuilder('hs')
      .select('hs.kecamatan', 'kecamatan')
      .addSelect('COUNT(*)', 'count')
      .groupBy('hs.kecamatan')
      .orderBy('count', 'DESC')
      .getRawMany();
  }

  async getSummary() {
    const total = await this.repo.count();
    const aktif = await this.repo.count({ where: { status: 'aktif' } });
    const byCategory = await this.getStatsByCategory();
    const byKecamatan = await this.getStatsByKecamatan();
    return { total, aktif, byCategory, byKecamatan };
  }
}
