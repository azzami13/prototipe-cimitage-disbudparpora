import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { TourPackage } from '../../common/entities/tour-package.entity';
import { PackageRoute } from '../../common/entities/package-route.entity';
import { CreateTourPackageDto } from './dto/create-tour-package.dto';
import { UpdateTourPackageDto } from './dto/update-tour-package.dto';

export interface TourPackageFindAllQuery {
  active?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class TourPackageService {
  constructor(
    @InjectRepository(TourPackage)
    private readonly pkgRepo: Repository<TourPackage>,
    @InjectRepository(PackageRoute)
    private readonly routeRepo: Repository<PackageRoute>,
  ) {}

  async findAll(query: TourPackageFindAllQuery = {}) {
    const { active, search, page = 1, limit = 10 } = query;

    const qb = this.pkgRepo
      .createQueryBuilder('tp')
      .leftJoinAndSelect('tp.routes', 'r')
      .leftJoinAndSelect('r.heritage_site', 'hs');

    if (active !== undefined) {
      qb.andWhere('tp.active = :active', { active });
    }
    if (search) {
      qb.andWhere('(tp.name ILIKE :search OR tp.code ILIKE :search)', {
        search: `%${search}%`,
      });
    }

    qb.orderBy('tp.name', 'ASC');

    // Pagination
    qb.skip((page - 1) * limit).take(limit);

    const [data, total] = await qb.getManyAndCount();

    // Sort routes by sequence for each package
    data.forEach((pkg) => {
      pkg.routes = pkg.routes?.sort((a, b) => a.sequence - b.sequence) ?? [];
    });

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: number) {
    const pkg = await this.pkgRepo.findOne({
      where: { id },
      relations: ['routes', 'routes.heritage_site'],
    });
    if (!pkg)
      throw new NotFoundException(`Tour package #${id} tidak ditemukan`);
    pkg.routes = pkg.routes?.sort((a, b) => a.sequence - b.sequence) ?? [];
    return pkg;
  }

  async create(dto: CreateTourPackageDto) {
    // Cek duplikasi kode
    const existing = await this.pkgRepo.findOne({ where: { code: dto.code } });
    if (existing) {
      throw new ConflictException(`Kode paket "${dto.code}" sudah digunakan`);
    }

    const { heritageIds, ...rest } = dto;
    const pkg = this.pkgRepo.create(rest);
    const saved = await this.pkgRepo.save(pkg);

    if (heritageIds?.length) {
      const routes = heritageIds.map((hsId, idx) =>
        this.routeRepo.create({
          tour_package_id: saved.id,
          heritage_site_id: hsId,
          sequence: idx + 1,
        }),
      );
      await this.routeRepo.save(routes);
    }

    return this.findOne(saved.id);
  }

  async update(id: number, dto: UpdateTourPackageDto) {
    await this.findOne(id);

    const { heritageIds, ...rest } = dto;

    if (rest.code) {
      const existing = await this.pkgRepo.findOne({
        where: { code: rest.code },
      });
      if (existing && existing.id !== id) {
        throw new ConflictException(
          `Kode paket "${rest.code}" sudah digunakan`,
        );
      }
    }

    if (Object.keys(rest).length > 0) {
      await this.pkgRepo.update(id, rest);
    }

    if (heritageIds !== undefined) {
      // Ganti semua routes
      await this.routeRepo.delete({ tour_package_id: id });
      if (heritageIds.length > 0) {
        const routes = heritageIds.map((hsId, idx) =>
          this.routeRepo.create({
            tour_package_id: id,
            heritage_site_id: hsId,
            sequence: idx + 1,
          }),
        );
        await this.routeRepo.save(routes);
      }
    }

    return this.findOne(id);
  }

  async remove(id: number) {
    const pkg = await this.findOne(id);
    // Hapus routes dulu (cascade)
    await this.routeRepo.delete({ tour_package_id: id });
    await this.pkgRepo.remove(pkg);
    return { message: `Paket "${pkg.name}" berhasil dihapus` };
  }

  async toggleActive(id: number) {
    const pkg = await this.findOne(id);
    await this.pkgRepo.update(id, { active: !pkg.active });
    return this.findOne(id);
  }

  async updateRouteSequence(
    packageId: number,
    sequences: Array<{ routeId: number; sequence: number }>,
  ) {
    await this.findOne(packageId);
    for (const s of sequences) {
      await this.routeRepo.update(
        { id: s.routeId, tour_package_id: packageId },
        { sequence: s.sequence },
      );
    }
    return this.findOne(packageId);
  }
}
