import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PackageRoute } from '../../common/entities/package-route.entity';
import { TourPackage } from '../../common/entities/tour-package.entity';
import { HeritageSite } from '../../common/entities/heritage-site.entity';
import { CreatePackageRouteDto } from './dto/create-package-route.dto';
import { UpdatePackageRouteDto } from './dto/update-package-route.dto';

@Injectable()
export class PackageRouteService {
  constructor(
    @InjectRepository(PackageRoute)
    private readonly routeRepo: Repository<PackageRoute>,
    @InjectRepository(TourPackage)
    private readonly pkgRepo: Repository<TourPackage>,
    @InjectRepository(HeritageSite)
    private readonly heritageRepo: Repository<HeritageSite>,
  ) {}

  /**
   * Ambil semua routes, opsional filter per paket
   */
  async findAll(tourPackageId?: number) {
    const qb = this.routeRepo
      .createQueryBuilder('pr')
      .leftJoinAndSelect('pr.heritage_site', 'hs')
      .leftJoinAndSelect('pr.tour_package', 'tp')
      .orderBy('pr.tour_package_id', 'ASC')
      .addOrderBy('pr.sequence', 'ASC');

    if (tourPackageId) {
      qb.where('pr.tour_package_id = :id', { id: tourPackageId });
    }

    return qb.getMany();
  }

  async findOne(id: number) {
    const route = await this.routeRepo.findOne({
      where: { id },
      relations: ['heritage_site', 'tour_package'],
    });
    if (!route) throw new NotFoundException(`Route #${id} tidak ditemukan`);
    return route;
  }

  async create(dto: CreatePackageRouteDto) {
    // Validasi paket ada
    const pkg = await this.pkgRepo.findOne({
      where: { id: dto.tour_package_id },
    });
    if (!pkg) {
      throw new NotFoundException(
        `Tour package #${dto.tour_package_id} tidak ditemukan`,
      );
    }

    // Validasi heritage site ada
    const site = await this.heritageRepo.findOne({
      where: { id: dto.heritage_site_id },
    });
    if (!site) {
      throw new NotFoundException(
        `Heritage site #${dto.heritage_site_id} tidak ditemukan`,
      );
    }

    // Cek apakah heritage site sudah ada di paket ini
    const existing = await this.routeRepo.findOne({
      where: {
        tour_package_id: dto.tour_package_id,
        heritage_site_id: dto.heritage_site_id,
      },
    });
    if (existing) {
      throw new BadRequestException(
        `Situs "${site.name}" sudah ada dalam paket ini`,
      );
    }

    const route = this.routeRepo.create(dto);
    const saved = await this.routeRepo.save(route);
    return this.findOne(saved.id);
  }

  async update(id: number, dto: UpdatePackageRouteDto) {
    await this.findOne(id);
    await this.routeRepo.update(id, dto);
    return this.findOne(id);
  }

  async remove(id: number) {
    const route = await this.findOne(id);
    await this.routeRepo.remove(route);
    return {
      message: `Route #${id} berhasil dihapus`,
    };
  }

  /**
   * Bulk reorder: update sequence untuk semua route dalam satu paket
   * Body: [{ id: routeId, sequence: newSequence }, ...]
   */
  async bulkReorder(
    tourPackageId: number,
    items: Array<{ id: number; sequence: number }>,
  ) {
    // Validasi paket ada
    const pkg = await this.pkgRepo.findOne({ where: { id: tourPackageId } });
    if (!pkg) {
      throw new NotFoundException(
        `Tour package #${tourPackageId} tidak ditemukan`,
      );
    }

    for (const item of items) {
      await this.routeRepo.update(
        { id: item.id, tour_package_id: tourPackageId },
        { sequence: item.sequence },
      );
    }

    return this.findAll(tourPackageId);
  }

  /**
   * Hapus semua route dalam satu paket (untuk reset)
   */
  async removeAllByPackage(tourPackageId: number) {
    const count = await this.routeRepo.count({
      where: { tour_package_id: tourPackageId },
    });
    await this.routeRepo.delete({ tour_package_id: tourPackageId });
    return { message: `${count} route berhasil dihapus dari paket` };
  }
}
