import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Booking } from './booking.entity';

export type SakociStatus =
  'available' | 'assigned' | 'maintenance' | 'inactive';
export type SakociTrackingVisibility = 'public' | 'user' | 'admin' | 'hidden';

@Entity('sakoci')
export class Sakoci {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ type: 'varchar', nullable: true })
  code: string | null;

  @Column({ type: 'varchar', nullable: true })
  plate_number: string | null;

  @Column({ type: 'varchar', nullable: true })
  image_url: string | null;

  @Column({ type: 'varchar', default: 'available' })
  status: SakociStatus;

  @Column({ default: true })
  active: boolean;

  @Column({ default: true })
  tracking_enabled: boolean;

  @Column({ type: 'varchar', default: 'admin' })
  tracking_visibility: SakociTrackingVisibility;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  latitude: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  longitude: number | null;

  @Column({ type: 'timestamp', nullable: true })
  location_updated_at: Date | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn()
  created_at: Date;

  @OneToMany(() => Booking, (booking) => booking.sakoci)
  bookings: Booking[];
}
