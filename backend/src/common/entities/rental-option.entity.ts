import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('rental_option')
export class RentalOption {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  base_price: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  price_per_person: number;

  @Column({ default: true })
  active: boolean;

  @CreateDateColumn()
  created_at: Date;
}
