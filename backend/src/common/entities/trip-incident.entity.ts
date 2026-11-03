import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { DriverTrip } from './driver-trip.entity';
import { User } from './user.entity';

export type TripIncidentStatus = 'OPEN' | 'IN_REVIEW' | 'RESOLVED';

@Entity('trip_incident')
export class TripIncident {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  trip_id: number;

  @Column()
  driver_id: number | null;

  @Column({ type: 'int', nullable: true })
  reported_by_user_id: number | null;

  @Column({ type: 'varchar', nullable: true })
  reporter_role: string | null;

  @Column({ type: 'varchar' })
  issue_type: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'varchar', default: 'OPEN' })
  status: TripIncidentStatus;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  reported_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  resolved_at: Date | null;

  @Column({ type: 'int', nullable: true })
  resolved_by: number | null;

  @Column({ type: 'text', nullable: true })
  resolution_note: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  latitude: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  longitude: number | null;

  @ManyToOne(() => DriverTrip, (trip) => trip.incidents, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'trip_id' })
  trip: DriverTrip;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'driver_id' })
  driver: User | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'reported_by_user_id' })
  reported_by_user: User | null;
}
