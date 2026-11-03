import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SystemSetting } from '../../../common/entities/system-setting.entity';
import { AuthenticatedUser } from '../../../common/security/authenticated-user';

export type SystemSettingsDto = {
  appName: string;
  agencyName: string;
  operationalHotline: string;
  customerSupportContact: string;
  operationalHours: string;
  paymentTimeoutHours: number;
  driverReadyOffsetMinutes: number;
  defaultCapacityLimit: number;
  trackingEnabled: boolean;
  publicTrackingEnabled: boolean;
  showPublicCurrentRoute: boolean;
  showSakociGraphRadius: boolean;
  pickupMaxSnapMeters: number;
};

const DEFAULTS: SystemSettingsDto = {
  appName: 'CimHeritage',
  agencyName: 'Dinas Kebudayaan Pariwisata Kepemudaan dan Olahraga Kota Cimahi',
  operationalHotline: '(022) 6631764',
  customerSupportContact: 'disbudparpora@cimahikota.go.id',
  operationalHours: 'Senin-Jumat, 08.00-16.00 WIB',
  paymentTimeoutHours: 24,
  driverReadyOffsetMinutes: 30,
  defaultCapacityLimit: 100,
  trackingEnabled: true,
  publicTrackingEnabled: true,
  showPublicCurrentRoute: true,
  showSakociGraphRadius: true,
  pickupMaxSnapMeters: Number(
    process.env.ROUTING_PICKUP_MAX_SNAP_METERS ?? 150,
  ),
};

@Injectable()
export class SettingsService {
  private cached: { value: SystemSettingsDto; expires: number } | null = null;

  constructor(
    @InjectRepository(SystemSetting)
    private readonly repo: Repository<SystemSetting>,
  ) {}

  async getSettings() {
    if (this.cached && this.cached.expires > Date.now())
      return this.cached.value;
    const rows = await this.repo.find();
    const value = { ...DEFAULTS };
    for (const row of rows) {
      if (row.key in value) (value as any)[row.key] = row.value;
    }
    const normalized = this.validate(value);
    this.cached = { value: normalized, expires: Date.now() + 30_000 };
    return normalized;
  }

  async updateSettings(
    actor: AuthenticatedUser,
    body: Partial<SystemSettingsDto>,
  ) {
    this.rejectSecretKeys(body);
    const current = await this.getSettings();
    const next = this.validate({ ...current, ...body });
    const keys = Object.keys(next) as Array<keyof SystemSettingsDto>;
    await this.repo.manager.transaction(async (manager) => {
      for (const key of keys) {
        await manager.upsert(
          SystemSetting,
          {
            key,
            value: next[key] as any,
            updated_by_user_id: actor.id,
          },
          ['key'],
        );
      }
    });
    this.cached = null;
    return this.getSettings();
  }

  async getDriverReadyOffsetMinutes() {
    return (await this.getSettings()).driverReadyOffsetMinutes;
  }

  private validate(input: SystemSettingsDto): SystemSettingsDto {
    const text = (value: unknown, label: string, max = 200) => {
      const trimmed = String(value ?? '').trim();
      if (!trimmed || trimmed.length > max)
        throw new BadRequestException(`${label} tidak valid`);
      return trimmed;
    };
    const intRange = (
      value: unknown,
      label: string,
      min: number,
      max: number,
    ) => {
      const number = Number(value);
      if (!Number.isInteger(number) || number < min || number > max) {
        throw new BadRequestException(
          `${label} harus antara ${min} dan ${max}`,
        );
      }
      return number;
    };
    const bool = (value: unknown, label: string) => {
      if (typeof value !== 'boolean')
        throw new BadRequestException(`${label} harus boolean`);
      return value;
    };
    const hours = text(input.operationalHours, 'Jam operasional', 160);
    if (!/\d{1,2}[.:]\d{2}.*\d{1,2}[.:]\d{2}/.test(hours)) {
      throw new BadRequestException(
        'Jam operasional harus memuat rentang jam, misalnya 08.00-16.00 WIB',
      );
    }
    return {
      appName: text(input.appName, 'Nama aplikasi', 80),
      agencyName: text(input.agencyName, 'Nama instansi', 180),
      operationalHotline: text(
        input.operationalHotline,
        'Hotline operasional',
        80,
      ),
      customerSupportContact: text(
        input.customerSupportContact,
        'Kontak customer support',
        120,
      ),
      operationalHours: hours,
      paymentTimeoutHours: intRange(
        input.paymentTimeoutHours,
        'Batas waktu pembayaran',
        1,
        168,
      ),
      driverReadyOffsetMinutes: intRange(
        input.driverReadyOffsetMinutes,
        'Offset hadir driver',
        0,
        240,
      ),
      defaultCapacityLimit: intRange(
        input.defaultCapacityLimit,
        'Kapasitas default',
        1,
        1000,
      ),
      trackingEnabled: bool(input.trackingEnabled, 'Tracking operasional'),
      publicTrackingEnabled: bool(
        input.publicTrackingEnabled,
        'Tracking publik',
      ),
      showPublicCurrentRoute: bool(
        input.showPublicCurrentRoute,
        'Rute publik Sakoci',
      ),
      showSakociGraphRadius: bool(
        input.showSakociGraphRadius,
        'Visualisasi graph sekitar Sakoci',
      ),
      pickupMaxSnapMeters: intRange(
        input.pickupMaxSnapMeters,
        'Batas snap pickup',
        25,
        1000,
      ),
    };
  }

  private rejectSecretKeys(body: Record<string, any>) {
    const forbidden = [
      'secret',
      'password',
      'token',
      'jwt',
      'api_key',
      'apikey',
      'credential',
    ];
    for (const key of Object.keys(body ?? {})) {
      const lower = key.toLowerCase();
      if (forbidden.some((item) => lower.includes(item))) {
        throw new BadRequestException(
          'Settings tidak boleh menyimpan secret atau credential',
        );
      }
    }
  }
}
