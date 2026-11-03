import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type RoutingBuildStatus = 'BUILDING' | 'ACTIVE' | 'FAILED' | 'STALE';

@Entity('routing_build')
@Index(['status', 'is_active'])
export class RoutingBuild {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', default: 'BUILDING' })
  status: RoutingBuildStatus;

  @Column({ default: false })
  is_active: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  started_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  finished_at: Date | null;

  @Column({ default: 0 })
  graph_node_count: number;

  @Column({ default: 0 })
  graph_edge_count: number;

  @Column({ default: 0 })
  asset_count: number;

  @Column({ default: 0 })
  routable_asset_count: number;

  @Column({ default: 0 })
  skipped_asset_count: number;

  @Column({ default: 0 })
  unreachable_pair_count: number;

  @Column({ type: 'varchar', nullable: true })
  source_hash: string | null;

  @Column({ type: 'text', nullable: true })
  error_message: string | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
