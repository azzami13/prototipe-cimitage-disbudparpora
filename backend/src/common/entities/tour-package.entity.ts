import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { PackageRoute } from './package-route.entity';
import { Booking } from './booking.entity';

@Entity('tour_package')
export class TourPackage {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  code: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  price_per_person: number;

  @Column({ default: true })
  active: boolean;

  @Column({ nullable: true })
  duration_hours: number;

  @Column({ nullable: true })
  image_url: string;

  @CreateDateColumn()
  created_at: Date;

  @OneToMany(() => PackageRoute, (pr) => pr.tour_package)
  routes: PackageRoute[];

  @OneToMany(() => Booking, (b) => b.tour_package)
  bookings: Booking[];
}
