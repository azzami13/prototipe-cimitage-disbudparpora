import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Role } from './role.entity';

export type AccountStatus = 'normal' | 'suspended' | 'review' | 'deleted';

@Entity('user')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ unique: true })
  email: string;

  @Column({ select: false })
  password: string;

  @Column({ nullable: true })
  role_id: number | null;

  @Column({ default: true })
  active: boolean;

  @Column({ type: 'varchar', default: 'normal' })
  account_status: AccountStatus;

  @Column({ nullable: true, type: 'varchar' })
  avatar_url: string | null;

  @Column({ nullable: true, type: 'varchar' })
  nik: string | null;

  @Column({ nullable: true, type: 'varchar' })
  birth_place: string | null;

  @Column({ nullable: true, type: 'date' })
  birth_date: string | null;

  @Column({ nullable: true, type: 'text' })
  domicile: string | null;

  @Column({ nullable: true, type: 'text' })
  ktp_address: string | null;

  @CreateDateColumn()
  registered_at: Date;

  @Column({ nullable: true, type: 'timestamp' })
  last_login: Date | null;

  @ManyToOne(() => Role, { nullable: true })
  @JoinColumn({ name: 'role_id' })
  role: Role | null;
}
