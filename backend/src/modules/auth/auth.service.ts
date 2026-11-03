import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import axios from 'axios';
import { User } from '../user/user.entity';
import {
  IsDateString,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { UserRole } from '../../common/enums/user-role.enum';
import { Role } from '../../common/entities/role.entity';

export class RegisterDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;
}

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}

export class GoogleAuthDto {
  @IsString()
  @IsNotEmpty()
  idToken: string;
}

export class UpdateProfileDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  nik: string;

  @IsString()
  @IsNotEmpty()
  birth_place: string;

  @IsDateString()
  birth_date: string;

  @IsString()
  @IsNotEmpty()
  domicile: string;

  @IsString()
  @IsNotEmpty()
  ktp_address: string;

  @IsOptional()
  @IsString()
  avatar_url?: string;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Role)
    private roleRepository: Repository<Role>,
    private jwtService: JwtService,
  ) {}

  async validateUser(
    emailValue: string,
    passwordValue: string,
  ): Promise<Omit<User, 'password'> | null> {
    const email = this.normalizeEmail(emailValue);
    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .leftJoinAndSelect('user.role', 'role')
      .where('user.email = :email', { email })
      .getOne();

    if (!user || !(await bcrypt.compare(passwordValue ?? '', user.password))) {
      return null;
    }

    if (!user.active || user.account_status !== 'normal') {
      throw new UnauthorizedException(
        this.getAccountStatusMessage(user.account_status),
      );
    }

    if (!user.role_id) {
      const customerRoleId = await this.getCustomerRoleId();
      await this.userRepository.update(user.id, {
        role_id: customerRoleId,
        last_login: new Date(),
      });
      user.role_id = customerRoleId;
      user.role = await this.roleRepository.findOne({
        where: { id: customerRoleId },
      });
    } else {
      await this.userRepository.update(user.id, { last_login: new Date() });
    }

    return this.toSafeUser(user);
  }

  login(user: Omit<User, 'password'>) {
    const payload = {
      sub: user.id,
      email: user.email,
      role_id: user.role_id,
      role: user.role?.name ?? UserRole.CUSTOMER,
      name: user.name,
      account_status: user.account_status,
      avatar_url: user.avatar_url,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: payload,
    };
  }

  async register(dto: RegisterDto) {
    const name = dto.name?.trim();
    const email = this.normalizeEmail(dto.email);
    const password = dto.password?.trim();

    if (!name) throw new BadRequestException('Nama wajib diisi');
    if (!password || password.length < 6) {
      throw new BadRequestException('Password minimal 6 karakter');
    }

    const existingUser = await this.userRepository.findOne({
      where: { email },
    });
    if (existingUser) {
      throw new BadRequestException('Email sudah terdaftar');
    }

    const user = await this.userRepository.save(
      this.userRepository.create({
        name,
        email,
        password: await bcrypt.hash(password, 10),
        role_id: await this.getCustomerRoleId(),
        active: true,
      }),
    );

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      active: user.active,
      account_status: user.account_status,
      registered_at: user.registered_at,
    };
  }

  async loginWithGoogle(dto: GoogleAuthDto) {
    const googleClientId = process.env.GOOGLE_CLIENT_ID?.trim();
    if (!googleClientId) {
      throw new InternalServerErrorException(
        'GOOGLE_CLIENT_ID belum dikonfigurasi pada backend',
      );
    }

    let payload: {
      aud?: string;
      email?: string;
      email_verified?: string | boolean;
      name?: string;
      picture?: string;
      iss?: string;
    };
    try {
      const response = await axios.get<typeof payload>(
        'https://oauth2.googleapis.com/tokeninfo',
        {
          params: { id_token: dto.idToken },
          timeout: 5000,
        },
      );
      payload = response.data;
    } catch {
      throw new UnauthorizedException('Token Google tidak valid');
    }

    const validIssuer =
      payload?.iss === 'accounts.google.com' ||
      payload?.iss === 'https://accounts.google.com';
    const emailVerified =
      payload?.email_verified === true || payload?.email_verified === 'true';
    if (
      !payload?.email ||
      !emailVerified ||
      payload.aud !== googleClientId ||
      !validIssuer
    ) {
      throw new UnauthorizedException(
        'Token Google bukan untuk aplikasi CimHeritage atau email belum terverifikasi',
      );
    }

    const email = this.normalizeEmail(payload.email);
    const name = payload.name?.trim() || email.split('@')[0];
    const avatarUrl = payload.picture?.trim() || null;
    let user = await this.userRepository.findOne({
      where: { email },
      relations: ['role'],
    });

    if (user) {
      if (!user.active || user.account_status !== 'normal') {
        throw new UnauthorizedException(
          this.getAccountStatusMessage(user.account_status),
        );
      }
      const update: Partial<User> = { last_login: new Date() };
      if (!user.role_id) update.role_id = await this.getCustomerRoleId();
      if (!user.avatar_url && avatarUrl) update.avatar_url = avatarUrl;
      if (!user.name?.trim() && name) update.name = name;
      await this.userRepository.update(user.id, update);
      user =
        (await this.userRepository.findOne({
          where: { id: user.id },
          relations: ['role'],
        })) ?? user;
      return this.login(this.toSafeUser(user));
    }

    const generatedPassword = await bcrypt.hash(
      randomBytes(48).toString('hex'),
      10,
    );
    user = await this.userRepository.save(
      this.userRepository.create({
        name,
        email,
        password: generatedPassword,
        avatar_url: avatarUrl,
        role_id: await this.getCustomerRoleId(),
        active: true,
        account_status: 'normal',
        last_login: new Date(),
      }),
    );
    const created = await this.userRepository.findOne({
      where: { id: user.id },
      relations: ['role'],
    });
    return this.login(this.toSafeUser(created ?? user));
  }

  async me(userId: number) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['role'],
    });

    if (!user || !user.active || user.account_status !== 'normal') {
      throw new UnauthorizedException('Session tidak valid');
    }

    return this.toSafeUser(user);
  }

  async updateProfile(userId: number, dto: UpdateProfileDto) {
    const current = await this.me(userId);
    await this.userRepository.update(current.id, {
      name: dto.name.trim(),
      nik: dto.nik.trim(),
      birth_place: dto.birth_place.trim(),
      birth_date: dto.birth_date,
      domicile: dto.domicile.trim(),
      ktp_address: dto.ktp_address.trim(),
      avatar_url: dto.avatar_url?.trim() || current.avatar_url,
    });

    const updated = await this.userRepository.findOne({
      where: { id: current.id },
      relations: ['role'],
    });
    if (!updated) throw new UnauthorizedException('Session tidak valid');
    return this.toSafeUser(updated);
  }

  async updateAvatar(userId: number, avatarUrl: string) {
    const current = await this.me(userId);
    await this.userRepository.update(current.id, { avatar_url: avatarUrl });
    const updated = await this.userRepository.findOne({
      where: { id: current.id },
      relations: ['role'],
    });
    if (!updated) throw new UnauthorizedException('Session tidak valid');
    return this.toSafeUser(updated);
  }

  private getAccountStatusMessage(status?: string) {
    if (status === 'suspended') return 'Akun sedang disuspend';
    if (status === 'review') return 'Akun sedang dalam peninjauan';
    if (status === 'deleted') return 'Akun sudah dihapus';
    return 'Akun tidak aktif';
  }

  private normalizeEmail(value?: string) {
    const email = value?.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new BadRequestException('Format email tidak valid');
    }

    return email;
  }

  private async getCustomerRoleId() {
    let role = await this.roleRepository.findOne({
      where: { name: UserRole.CUSTOMER },
    });
    if (!role) {
      role = await this.roleRepository.save(
        this.roleRepository.create({ name: UserRole.CUSTOMER }),
      );
    }
    return role.id;
  }

  private toSafeUser(user: User) {
    const safeUser = { ...user } as Omit<User, 'password'> & {
      password?: string;
    };
    delete safeUser.password;
    return safeUser;
  }
}
