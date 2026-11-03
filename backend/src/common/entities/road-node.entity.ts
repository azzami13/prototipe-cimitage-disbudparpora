import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { RoadEdge } from './road-edge.entity';
import { DestinationNode } from './destination-node.entity';

export interface GeoJsonPoint {
  type: 'Point';
  coordinates: [number, number];
}

@Entity('road_node')
export class RoadNode {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  code: string;

  @Column({ type: 'decimal', precision: 10, scale: 7 })
  latitude: number;

  @Column({ type: 'decimal', precision: 10, scale: 7 })
  longitude: number;

  @Index('IDX_road_node_point_geom', { spatial: true })
  @Column({
    name: 'point_geom',
    type: 'geometry',
    spatialFeatureType: 'Point',
    srid: 4326,
    nullable: true,
  })
  point_geom: GeoJsonPoint | null;

  @Column({ type: 'varchar', nullable: true })
  type: string | null;

  @Column({ type: 'varchar', nullable: true })
  name: string | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany(() => RoadEdge, (edge) => edge.from_node)
  outgoing_edges: RoadEdge[];

  @OneToMany(() => RoadEdge, (edge) => edge.to_node)
  incoming_edges: RoadEdge[];

  @OneToMany(
    () => DestinationNode,
    (destinationNode) => destinationNode.road_node,
  )
  destination_nodes: DestinationNode[];
}
