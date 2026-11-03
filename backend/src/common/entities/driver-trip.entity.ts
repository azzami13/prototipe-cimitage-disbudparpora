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
import { Booking } from './booking.entity';
import { User } from './user.entity';
import { Sakoci } from './sakoci.entity';
import { TripItineraryItem } from './trip-itinerary-item.entity';
import { TripStatusHistory } from './trip-status-history.entity';
import { TripLocationLog } from './trip-location-log.entity';
import { TripIncident } from './trip-incident.entity';
import { TripGuideSession } from './trip-guide-session.entity';

export const TRIP_STATUSES = [
  'ASSIGNED',
  'ACCEPTED',
  'EN_ROUTE_TO_PICKUP',
  'AT_PICKUP',
  'EN_ROUTE_TO_DESTINATION',
  'AT_DESTINATION',
  'EN_ROUTE_TO_ENDPOINT',
  'COMPLETED',
  'CANCELLED',
  'ISSUE_REPORTED',
] as const;

export type TripStatus = (typeof TRIP_STATUSES)[number];

@Entity('driver_trip')
export class DriverTrip {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  booking_id: number;

  @Column()
  driver_id: number;

  @Column({ type: 'int', nullable: true })
  tour_guide_id: number | null;

  @Column()
  sakoci_id: number;

  @Column()
  assigned_by_admin_id: number;

  @Column()
  booking_reference: string;

  @Column({ type: 'timestamp' })
  scheduled_user_pickup_at: Date;

  @Column({ type: 'timestamp' })
  driver_ready_at: Date;

  @Column({ type: 'int', default: 30 })
  driver_lead_time_minutes: number;

  @Column({ type: 'int' })
  estimated_duration_minutes: number;

  @Column({ type: 'timestamp' })
  estimated_end_at: Date;

  @Column({ type: 'varchar', default: 'ASSIGNED' })
  trip_status: TripStatus;

  @Column({ type: 'int', nullable: true })
  current_itinerary_item_id: number | null;

  @Column({ type: 'int', nullable: true })
  current_stop_sequence: number | null;

  @Column({ default: false })
  tracking_active: boolean;

  @Column({ type: 'timestamp', nullable: true })
  tracking_started_at: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  tracking_ended_at: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  assigned_at: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  accepted_at: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  en_route_pickup_at: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  arrived_pickup_at: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  journey_started_at: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  completed_at: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  cancelled_at: Date | null;

  @Column({ type: 'text', nullable: true })
  cancellation_reason: string | null;

  @Column({ type: 'jsonb', nullable: true })
  route_snapshot: any;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => Booking)
  @JoinColumn({ name: 'booking_id' })
  booking: Booking;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'driver_id' })
  driver: User;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'tour_guide_id' })
  tour_guide: User | null;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'assigned_by_admin_id' })
  assigned_by_admin: User;

  @ManyToOne(() => Sakoci)
  @JoinColumn({ name: 'sakoci_id' })
  sakoci: Sakoci;

  @OneToMany(() => TripItineraryItem, (item) => item.trip)
  itinerary_items: TripItineraryItem[];

  @OneToMany(() => TripStatusHistory, (history) => history.trip)
  status_history: TripStatusHistory[];

  @OneToMany(() => TripLocationLog, (location) => location.trip)
  location_logs: TripLocationLog[];

  @OneToMany(() => TripIncident, (incident) => incident.trip)
  incidents: TripIncident[];

  @OneToMany(() => TripGuideSession, (session) => session.trip)
  guide_sessions: TripGuideSession[];
}
