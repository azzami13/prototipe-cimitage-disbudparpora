import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { Role } from '../../common/entities/role.entity';
import { AccountStatus, User } from '../../common/entities/user.entity';
import { CreateAdminUserDto } from './dto/create-admin-user.dto';
import { AuthenticatedUser } from '../../common/security/authenticated-user';
import { AuditService } from '../operations/services/audit.service';

export interface AdminUsersQuery {
  search?: string;
  status?: AccountStatus;
  role?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class AdminUsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
    private readonly auditService: AuditService,
  ) {}

  async findAll(query: AdminUsersQuery = {}) {
    const { search, status, role, page = 1, limit = 15 } = query;
    const qb = this.userRepo
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.role', 'role')
      .orderBy('user.registered_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (search) {
      qb.andWhere('(user.name ILIKE :search OR user.email ILIKE :search)', {
        search: `%${search}%`,
      });
    }

    if (status) {
      qb.andWhere('user.account_status = :status', { status });
    }

    if (role) {
      qb.andWhere('role.name = :role', { role });
    }

    const [data, total] = await qb.getManyAndCount();
    return {
      data: data.map((user) => this.toSafeUser(user)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: number) {
    const user = await this.userRepo.findOne({
      where: { id },
      relations: ['role'],
    });
    if (!user) throw new NotFoundException(`User #${id} tidak ditemukan`);
    return this.toSafeUser(user);
  }

  async create(dto: CreateAdminUserDto, actor?: AuthenticatedUser) {
    const name = dto.name?.trim();
    const email = dto.email?.trim().toLowerCase();
    const password = dto.password?.trim();
    const status = dto.account_status ?? 'normal';

    if (!name) throw new BadRequestException('Nama user wajib diisi');
    if (!email) throw new BadRequestException('Email user wajib diisi');
    if (!password || password.length < 6) {
      throw new BadRequestException('Password minimal 6 karakter');
    }
    const profile = this.validateIdentityProfile(dto);

    const existing = await this.userRepo.findOne({ where: { email } });
    if (existing) throw new ConflictException('Email sudah digunakan');

    if (dto.role_id) await this.ensureRole(dto.role_id);

    const user = await this.userRepo.save(
      this.userRepo.create({
        name,
        email,
        password: await bcrypt.hash(password, 10),
        role_id: dto.role_id,
        account_status: status,
        active: status === 'normal',
        ...profile,
      }),
    );

    const safe = await this.findOne(user.id);
    await this.auditService.record({
      actor,
      action: 'user.create',
      entityType: 'user',
      entityId: user.id,
      scope: 'system',
      metadata: { email, roleId: dto.role_id ?? null, accountStatus: status },
    });
    return safe;
  }

  async updateStatus(
    id: number,
    status: AccountStatus,
    actor?: AuthenticatedUser,
  ) {
    await this.findOne(id);
    await this.userRepo.update(id, {
      account_status: status,
      active: status === 'normal',
    });
    const user = await this.findOne(id);
    await this.auditService.record({
      actor,
      action: 'user.status.update',
      entityType: 'user',
      entityId: id,
      scope: 'system',
      metadata: { status },
    });
    return user;
  }

  async updateRole(
    id: number,
    roleId?: number | null,
    actor?: AuthenticatedUser,
  ) {
    await this.findOne(id);
    if (roleId) await this.ensureRole(roleId);
    await this.userRepo.update(id, { role_id: roleId || undefined });
    const user = await this.findOne(id);
    await this.auditService.record({
      actor,
      action: 'user.role.update',
      entityType: 'user',
      entityId: id,
      scope: 'system',
      metadata: { roleId: roleId ?? null },
    });
    return user;
  }

  async remove(id: number, actor?: AuthenticatedUser) {
    const user = await this.updateStatus(id, 'deleted', actor);
    return {
      message: `Akun "${user.name}" berhasil ditandai sebagai dihapus`,
      user,
    };
  }

  roles() {
    return this.roleRepo.find({ order: { name: 'ASC' } });
  }

  private toSafeUser(user: User) {
    const { password, ...safeUser } = user as User & { password?: string };
    return safeUser;
  }

  private async ensureRole(roleId: number) {
    const role = await this.roleRepo.findOne({ where: { id: roleId } });
    if (!role) throw new BadRequestException('Role tidak valid');
    return role;
  }

  private validateIdentityProfile(dto: CreateAdminUserDto) {
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
}
