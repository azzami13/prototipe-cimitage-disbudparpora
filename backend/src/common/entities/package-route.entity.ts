import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { TourPackage } from './tour-package.entity';
import { HeritageSite } from './heritage-site.entity';

@Entity('package_route')
export class PackageRoute {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  tour_package_id: number;

  @Column()
  heritage_site_id: number;

  @Column()
  sequence: number;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @ManyToOne(() => TourPackage, (tp) => tp.routes)
  @JoinColumn({ name: 'tour_package_id' })
  tour_package: TourPackage;

  @ManyToOne(() => HeritageSite, (hs) => hs.package_routes)
  @JoinColumn({ name: 'heritage_site_id' })
  heritage_site: HeritageSite;
}
