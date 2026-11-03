import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';

import { PackageRoute } from './package-route.entity';
import { HeritageCategory } from '../enums/heritage-category.enum';

export interface HeritageMediaItem {
  url: string;
  title?: string;
  is_visible?: boolean;
}

export interface GeoJsonPoint {
  type: 'Point';
  coordinates: [number, number];
}

@Entity('heritage_site')
export class HeritageSite {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({
    type: 'enum',
    enum: HeritageCategory,
  })
  category: HeritageCategory;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ nullable: true })
  address: string;

  @Column({ nullable: true })
  kelurahan: string;

  @Column({ nullable: true })
  kecamatan: string;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  latitude: number;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true })
  longitude: number;

  @Index('IDX_heritage_site_point_geom', { spatial: true })
  @Column({
    name: 'point_geom',
    type: 'geometry',
    spatialFeatureType: 'Point',
    srid: 4326,
    nullable: true,
  })
  point_geom: GeoJsonPoint | null;

  @Column({ nullable: true })
  no_register: string;

  @Column({ nullable: true })
  sk_penetapan: string;

  @Column({ type: 'varchar', default: 'aktif' })
  status: string;

  @Column({ nullable: true })
  image_url: string;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  images: HeritageMediaItem[];

  @Column({ type: 'jsonb', default: () => "'[]'" })
  youtube_links: HeritageMediaItem[];

  @Column({ type: 'jsonb', default: () => "'[]'" })
  pdf_files: HeritageMediaItem[];

  @Column({ nullable: true })
  tahun_register: string;

  @CreateDateColumn()
  created_at: Date;

  @OneToMany(() => PackageRoute, (pr) => pr.heritage_site)
  package_routes: PackageRoute[];
}
