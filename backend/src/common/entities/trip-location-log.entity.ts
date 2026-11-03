import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { DriverTrip } from './driver-trip.entity';
import type { TripStatus } from './driver-trip.entity';
import { TripItineraryItem } from './trip-itinerary-item.entity';

@Entity('trip_location_log')
@Index(['trip_id', 'captured_at'])
export class TripLocationLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  trip_id: number;

  @Column()
  booking_id: number;

  @Column()
  sakoci_id: number;

  @Column()
  driver_id: number;

  @Column({ type: 'decimal', precision: 10, scale: 7 })
  latitude: number;

  @Column({ type: 'decimal', precision: 10, scale: 7 })
  longitude: number;

  @Column({ type: 'decimal', precision: 8, scale: 2, nullable: true })
  accuracy: number | null;

  @Column({ type: 'decimal', precision: 8, scale: 2, nullable: true })
  speed_kmh: number | null;

  @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true })
  heading: number | null;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  captured_at: Date;

  @Column({ type: 'varchar' })
  current_trip_status: TripStatus;

  @Column({ type: 'int', nullable: true })
  current_itinerary_item_id: number | null;

  @ManyToOne(() => DriverTrip, (trip) => trip.location_logs, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'trip_id' })
  trip: DriverTrip;

  @ManyToOne(() => TripItineraryItem, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'current_itinerary_item_id' })
  current_itinerary_item: TripItineraryItem | null;
}
