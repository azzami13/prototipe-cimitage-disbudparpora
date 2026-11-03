import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { TourPackage } from './tour-package.entity';
import { User } from './user.entity';
import { RentalOption } from './rental-option.entity';
import { Sakoci } from './sakoci.entity';

export type BookingStatus =
  | 'pending'
  | 'confirmed'
  | 'assigned'
  | 'in_progress'
  | 'cancelled'
  | 'completed';
export type BookingType = 'package' | 'rental' | 'private';
export type PaymentStatus =
  | 'unpaid'
  | 'waiting_verification'
  | 'paid'
  | 'rejected'
  | 'expired'
  | 'refunded';

@Entity('booking')
export class Booking {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  group_name: string;

  @Column({ nullable: true })
  user_id: number;

  @Column({ nullable: true })
  tour_package_id: number;

  @Column({ nullable: true })
  rental_option_id: number;

  @Column({ type: 'varchar', default: 'package' })
  booking_type: BookingType;

  @Column({ type: 'date', nullable: true })
  visit_date: Date;

  @Column({ nullable: true })
  pickup_time: string;

  @Column({ nullable: true })
  pickup_location: string;

  @Column({ nullable: true })
  pickup_maps_url: string;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  pickup_latitude: number;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  pickup_longitude: number;

  @Column({ type: 'jsonb', nullable: true })
  private_destination_ids: number[];

  @Column()
  participants: number;

  @Column({ type: 'varchar', default: 'pending' })
  status: BookingStatus;

  @Column({ type: 'varchar', default: 'unpaid' })
  payment_status: PaymentStatus;

  @Column({ type: 'varchar', nullable: true })
  payment_method: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  paid_amount: number | null;

  @Column({ type: 'varchar', nullable: true })
  payment_proof_url: string | null;

  @Column({ type: 'varchar', nullable: true })
  admin_payment_proof_url: string | null;

  @Column({ type: 'text', nullable: true })
  payment_notes: string | null;

  @Column({ type: 'text', nullable: true })
  payment_rejection_reason: string | null;

  @Column({ type: 'int', nullable: true })
  payment_verified_by_user_id: number | null;

  @Column({ type: 'timestamp', nullable: true })
  payment_verified_at: Date | null;

  @Column({ type: 'int', nullable: true })
  payment_rejected_by_user_id: number | null;

  @Column({ type: 'timestamp', nullable: true })
  payment_rejected_at: Date | null;

  @Column({ type: 'int', nullable: true })
  assigned_tour_guide_id: number | null;

  @Column({ type: 'int', nullable: true })
  assigned_driver_id: number | null;

  @Column({ type: 'int', nullable: true })
  sakoci_id: number | null;

  @Column({ type: 'varchar', nullable: true })
  vehicle_name: string | null;

  @Column({ type: 'varchar', nullable: true })
  vehicle_plate_number: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  vehicle_latitude: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  vehicle_longitude: number | null;

  @Column({ type: 'timestamp', nullable: true })
  vehicle_location_updated_at: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  cancelled_at: Date | null;

  @Column({ type: 'int', nullable: true })
  cancelled_by_user_id: number | null;

  @Column({ type: 'varchar', nullable: true })
  cancelled_by_role: string | null;

  @Column({ type: 'text', nullable: true })
  cancellation_reason: string | null;

  @Column({ nullable: true })
  contact_phone: string;

  @Column({ nullable: true })
  contact_email: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  total_price: number;

  @CreateDateColumn()
  created_at: Date;

  @ManyToOne(() => TourPackage, (tp) => tp.bookings, { nullable: true })
  @JoinColumn({ name: 'tour_package_id' })
  tour_package: TourPackage;

  @ManyToOne(() => RentalOption, { nullable: true })
  @JoinColumn({ name: 'rental_option_id' })
  rental_option: RentalOption;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'assigned_tour_guide_id' })
  tour_guide: User;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'assigned_driver_id' })
  driver: User;

  @ManyToOne(() => Sakoci, (sakoci) => sakoci.bookings, { nullable: true })
  @JoinColumn({ name: 'sakoci_id' })
  sakoci: Sakoci;
}
