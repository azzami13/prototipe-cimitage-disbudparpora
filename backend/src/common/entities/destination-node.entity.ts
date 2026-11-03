import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { HeritageSite } from './heritage-site.entity';
import { RoadNode } from './road-node.entity';

@Entity('destination_node')
export class DestinationNode {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  heritage_site_id: number;

  @Column({ nullable: true })
  road_node_id: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 3 })
  distance_to_node_km: number;

  @Column({ type: 'decimal', precision: 14, scale: 3, nullable: true })
  snap_distance_m: number | null;

  @Column({ type: 'varchar', default: 'READY' })
  routing_status: string;

  @Column({ type: 'text', nullable: true })
  routing_error: string | null;

  @Column({ type: 'uuid', nullable: true })
  routing_build_id: string | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => HeritageSite)
  @JoinColumn({ name: 'heritage_site_id' })
  heritage_site: HeritageSite;

  @ManyToOne(() => RoadNode, (roadNode) => roadNode.destination_nodes, {
    nullable: true,
  })
  @JoinColumn({ name: 'road_node_id' })
  road_node: RoadNode | null;
}
