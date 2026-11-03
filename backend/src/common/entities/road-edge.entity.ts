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
import { RoadNode } from './road-node.entity';

export interface GeoJsonLineString {
  type: 'LineString';
  coordinates: [number, number][];
}

@Entity('road_edge')
export class RoadEdge {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  code: string;

  @Column()
  from_node_id: number;

  @Column()
  to_node_id: number;

  @Column({ type: 'decimal', precision: 10, scale: 3 })
  distance_km: number;

  @Column({ type: 'varchar', nullable: true })
  road_name: string | null;

  @Column({ default: false })
  oneway: boolean;

  @Column({ default: true })
  vehicle_accessible: boolean;

  @Column({ type: 'jsonb', nullable: true })
  geometry: number[][] | null;

  @Index('IDX_road_edge_line_geom', { spatial: true })
  @Column({
    name: 'line_geom',
    type: 'geometry',
    spatialFeatureType: 'LineString',
    srid: 4326,
    nullable: true,
  })
  line_geom: GeoJsonLineString | null;

  @Column({ type: 'decimal', precision: 14, scale: 3, nullable: true })
  forward_cost_m: number | null;

  @Column({ type: 'decimal', precision: 14, scale: 3, nullable: true })
  reverse_cost_m: number | null;

  @Column({ default: true })
  sakoci_allowed: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => RoadNode, (node) => node.outgoing_edges)
  @JoinColumn({ name: 'from_node_id' })
  from_node: RoadNode;

  @ManyToOne(() => RoadNode, (node) => node.incoming_edges)
  @JoinColumn({ name: 'to_node_id' })
  to_node: RoadNode;
}
