import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository } from 'typeorm';
import { AuditLog } from '../../../common/entities/audit-log.entity';
import { AuthenticatedUser } from '../../../common/security/authenticated-user';
import { UserRole } from '../../../common/enums/user-role.enum';

type AuditInput = {
  actor?: Pick<AuthenticatedUser, 'id' | 'role'> | null;
  action: string;
  entityType: string;
  entityId?: string | number | null;
  bookingCode?: string | null;
  scope?: 'operational' | 'security' | 'system';
  metadata?: Record<string, any> | null;
};

const SENSITIVE_KEYS = [
  'password',
  'token',
  'secret',
  'payment_proof_url',
  'admin_payment_proof_url',
  'contact_phone',
  'contact_email',
  'pickup_location',
  'pickup_maps_url',
];

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog) private readonly repo: Repository<AuditLog>,
  ) {}

  async record(input: AuditInput) {
    await this.repo.save(
      this.repo.create({
        actor_user_id: input.actor?.id ?? null,
        actor_role: input.actor?.role ?? null,
        action: input.action,
        entity_type: input.entityType,
        entity_id:
          input.entityId === undefined || input.entityId === null
            ? null
            : String(input.entityId),
        booking_code: input.bookingCode ?? null,
        scope: input.scope ?? 'operational',
        metadata: this.sanitize(input.metadata ?? {}),
      }),
    );
  }

  async list(user: AuthenticatedUser, query: Record<string, any>) {
    const page = Math.max(1, Number(query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit ?? 30)));
    const where: any = {};
    if (user.role === UserRole.ADMIN_OPERASIONAL) where.scope = 'operational';
    if (query.action) where.action = query.action;
    if (query.actor_role) where.actor_role = query.actor_role;
    if (query.entity_type) where.entity_type = query.entity_type;
    if (query.booking_code) where.booking_code = query.booking_code;
    if (query.date_from && query.date_to) {
      where.created_at = Between(
        new Date(query.date_from),
        new Date(query.date_to),
      );
    }
    const [data, total] = await this.repo.findAndCount({
      where,
      order: { created_at: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return {
      data: data.map((item) => ({
        ...item,
        metadata: this.sanitize(item.metadata ?? {}),
      })),
      total,
      page,
      limit,
    };
  }

  sanitize(metadata: Record<string, any>) {
    const safe: Record<string, any> = {};
    for (const [key, value] of Object.entries(metadata)) {
      if (
        SENSITIVE_KEYS.some((sensitive) =>
          key.toLowerCase().includes(sensitive),
        )
      )
        continue;
      if (value && typeof value === 'object' && !Array.isArray(value))
        safe[key] = this.sanitize(value);
      else safe[key] = value;
    }
    return safe;
  }
}
