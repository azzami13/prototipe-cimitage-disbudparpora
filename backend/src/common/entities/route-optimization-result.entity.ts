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
import { Booking } from './booking.entity';
import { GeoJsonLineString } from './destination-distance.entity';

export type RouteOptimizationStatus = 'pending' | 'success' | 'failed';
export type RouteSnapshotStatus = 'pending' | 'final' | 'stale' | 'failed';

@Entity('route_optimization_result')
export class RouteOptimizationResult {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  booking_id: number;

  @Column({ type: 'varchar', default: 'pending' })
  status: RouteOptimizationStatus;

  @Column({ type: 'varchar', nullable: true })
  algorithm: string | null;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  ordered_destination_ids: number[];

  @Column({ type: 'decimal', precision: 10, scale: 3, default: 0 })
  total_distance_km: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  total_duration_minutes: number | null;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  segments: any[];

  @Column({ type: 'jsonb', default: () => "'[]'" })
  evaluated_routes: any[];

  @Column({ type: 'jsonb', nullable: true })
  osrm_geometry: any;

  @Column({ type: 'jsonb', nullable: true })
  route_geojson: any;

  @Index('IDX_route_optimization_route_geometry', { spatial: true })
  @Column({
    type: 'geometry',
    spatialFeatureType: 'LineString',
    srid: 4326,
    nullable: true,
    select: false,
  })
  route_geometry: GeoJsonLineString | null;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  route_node_ids: number[];

  @Column({ type: 'jsonb', default: () => "'[]'" })
  route_edge_ids: number[];

  @Column({ type: 'varchar', nullable: true })
  route_source: string | null;

  @Column({ type: 'varchar', default: 'pending' })
  route_status: RouteSnapshotStatus;

  @Column({ type: 'varchar', nullable: true })
  route_fingerprint: string | null;

  @Column({ type: 'uuid', nullable: true })
  routing_build_id: string | null;

  @Column({ type: 'timestamp', nullable: true })
  finalized_at: Date | null;

  @Column({ type: 'int', nullable: true })
  finalized_by_user_id: number | null;

  @Column({ type: 'text', nullable: true })
  stale_reason: string | null;

  @Column({ type: 'jsonb', nullable: true })
  route_summary: any;

  @Column({ type: 'text', nullable: true })
  error_message: string | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => Booking)
  @JoinColumn({ name: 'booking_id' })
  booking: Booking;
}
