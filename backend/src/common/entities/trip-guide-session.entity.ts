import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DriverTrip } from './driver-trip.entity';
import { TripItineraryItem } from './trip-itinerary-item.entity';
import { User } from './user.entity';

export type GuideSessionStatus =
  'PENDING' | 'READY' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED';

@Entity('trip_guide_session')
export class TripGuideSession {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  trip_id: number;

  @Column()
  itinerary_item_id: number;

  @Column()
  tour_guide_id: number;

  @Column({ type: 'varchar', default: 'PENDING' })
  session_status: GuideSessionStatus;

  @Column({ type: 'timestamp', nullable: true })
  started_at: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  completed_at: Date | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => DriverTrip, (trip) => trip.guide_sessions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'trip_id' })
  trip: DriverTrip;

  @ManyToOne(() => TripItineraryItem, (item) => item.guide_sessions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'itinerary_item_id' })
  itinerary_item: TripItineraryItem;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'tour_guide_id' })
  tour_guide: User;
}
