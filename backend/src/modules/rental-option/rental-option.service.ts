import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RentalOption } from '../../common/entities/rental-option.entity';
import { CreateRentalOptionDto } from './dto/create-rental-option.dto';
import { UpdateRentalOptionDto } from './dto/update-rental-option.dto';

@Injectable()
export class RentalOptionService {
  constructor(
    @InjectRepository(RentalOption)
    private readonly repo: Repository<RentalOption>,
  ) {}

  findAll(active?: boolean) {
    return this.repo.find({
      where: active === undefined ? {} : { active },
      order: { created_at: 'DESC' },
    });
  }

  async findOne(id: number) {
    const option = await this.repo.findOne({ where: { id } });
    if (!option)
      throw new NotFoundException(`Opsi sewa #${id} tidak ditemukan`);
    return option;
  }

  async create(dto: CreateRentalOptionDto) {
    const name = dto.name?.trim();
    if (!name) throw new BadRequestException('Nama opsi sewa wajib diisi');

    return this.repo.save(
      this.repo.create({
        name,
        description: dto.description?.trim() || undefined,
        base_price: Number(dto.base_price ?? 0),
        price_per_person: Number(dto.price_per_person ?? 0),
        active: dto.active ?? true,
      }),
    );
  }

  async update(id: number, dto: UpdateRentalOptionDto) {
    await this.findOne(id);
    await this.repo.update(id, {
      name: dto.name?.trim(),
      description: dto.description?.trim() || undefined,
      base_price: Number(dto.base_price ?? 0),
      price_per_person: Number(dto.price_per_person ?? 0),
      active: dto.active ?? true,
    });
    return this.findOne(id);
  }

  async remove(id: number) {
    const option = await this.findOne(id);
    await this.repo.remove(option);
    return { message: `Opsi sewa "${option.name}" berhasil dihapus` };
  }
}
