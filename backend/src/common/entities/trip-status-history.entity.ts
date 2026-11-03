import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { DriverTrip } from './driver-trip.entity';
import { TripItineraryItem } from './trip-itinerary-item.entity';
import { User } from './user.entity';

@Entity('trip_status_history')
export class TripStatusHistory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  trip_id: number;

  @Column({ type: 'int', nullable: true })
  itinerary_item_id: number | null;

  @Column({ type: 'varchar', nullable: true })
  previous_status: string | null;

  @Column({ type: 'varchar' })
  new_status: string;

  @Column({ type: 'varchar' })
  action: string;

  @Column()
  changed_by_user_id: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  changed_at: Date;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  latitude: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  longitude: number | null;

  @ManyToOne(() => DriverTrip, (trip) => trip.status_history, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'trip_id' })
  trip: DriverTrip;

  @ManyToOne(() => TripItineraryItem, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'itinerary_item_id' })
  itinerary_item: TripItineraryItem | null;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'changed_by_user_id' })
  changed_by: User;
}
