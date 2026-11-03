import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('audit_log')
export class AuditLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int', nullable: true })
  actor_user_id: number | null;

  @Column({ type: 'varchar', nullable: true })
  actor_role: string | null;

  @Index()
  @Column({ type: 'varchar' })
  action: string;

  @Index()
  @Column({ type: 'varchar' })
  entity_type: string;

  @Column({ type: 'varchar', nullable: true })
  entity_id: string | null;

  @Index()
  @Column({ type: 'varchar', nullable: true })
  booking_code: string | null;

  @Column({ type: 'varchar', default: 'operational' })
  scope: 'operational' | 'security' | 'system';

  @Column({ type: 'jsonb', nullable: true })
  metadata: any;

  @CreateDateColumn()
  created_at: Date;
}
