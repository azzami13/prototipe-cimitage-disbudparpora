import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { HeritageSite } from './heritage-site.entity';

export interface GeoJsonLineString {
  type: 'LineString';
  coordinates: [number, number][];
}

@Entity('destination_distance')
export class DestinationDistance {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  from_heritage_site_id: number;

  @Column()
  to_heritage_site_id: number;

  @Column({ type: 'decimal', precision: 10, scale: 3 })
  distance_km: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  duration_minutes: number | null;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  path_node_ids: number[];

  @Column({ type: 'jsonb', default: () => "'[]'" })
  path_edge_ids: number[];

  @Column({ type: 'jsonb', nullable: true })
  path_geojson: any;

  @Index('IDX_destination_distance_path_geometry', { spatial: true })
  @Column({
    type: 'geometry',
    spatialFeatureType: 'LineString',
    srid: 4326,
    nullable: true,
    select: false,
  })
  path_geometry: GeoJsonLineString | null;

  @Column({ type: 'varchar', nullable: true })
  calculation_method: string | null;

  @Column({ type: 'uuid', nullable: true })
  routing_build_id: string | null;

  @Column({ type: 'decimal', precision: 14, scale: 3, nullable: true })
  haversine_distance_m: number | null;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  path_edge_steps: Array<[string, boolean]>;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => HeritageSite)
  @JoinColumn({ name: 'from_heritage_site_id' })
  from_heritage_site: HeritageSite;

  @ManyToOne(() => HeritageSite)
  @JoinColumn({ name: 'to_heritage_site_id' })
  to_heritage_site: HeritageSite;
}
