import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DriverTrip } from './driver-trip.entity';
import { HeritageSite } from './heritage-site.entity';
import { TripGuideSession } from './trip-guide-session.entity';

export type TripStopType = 'PICKUP' | 'DESTINATION' | 'ENDPOINT';
export type TripStopStatus =
  'PENDING' | 'EN_ROUTE' | 'ARRIVED' | 'VISITING' | 'COMPLETED' | 'SKIPPED';

@Entity('trip_itinerary_item')
export class TripItineraryItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  trip_id: number;

  @Column({ type: 'int' })
  sequence: number;

  @Column({ type: 'varchar' })
  stop_type: TripStopType;

  @Column({ type: 'int', nullable: true })
  heritage_site_id: number | null;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  address: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  latitude: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  longitude: number | null;

  @Column({ type: 'int', nullable: true })
  planned_duration_minutes: number | null;

  @Column({ type: 'timestamp', nullable: true })
  estimated_arrival_at: Date | null;

  @Column({ type: 'varchar', default: 'PENDING' })
  stop_status: TripStopStatus;

  @Column({ type: 'timestamp', nullable: true })
  en_route_at: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  arrived_at: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  completed_at: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  skipped_at: Date | null;

  @Column({ type: 'text', nullable: true })
  skip_reason: string | null;

  @Column({ type: 'jsonb', nullable: true })
  guide_content_snapshot: any;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => DriverTrip, (trip) => trip.itinerary_items, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'trip_id' })
  trip: DriverTrip;

  @ManyToOne(() => HeritageSite, { nullable: true })
  @JoinColumn({ name: 'heritage_site_id' })
  heritage_site: HeritageSite | null;

  @OneToMany(() => TripGuideSession, (session) => session.itinerary_item)
  guide_sessions: TripGuideSession[];
}
