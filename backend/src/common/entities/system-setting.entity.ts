import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('system_setting')
export class SystemSetting {
  @PrimaryColumn({ type: 'varchar', length: 80 })
  key: string;

  @Column({ type: 'jsonb' })
  value: any;

  @Column({ type: 'int', nullable: true })
  updated_by_user_id: number | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
