import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { User } from './user.entity';

@Entity('role')
export class Role {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  name: string; // super_admin, admin_operasional, tour_guide, driver, customer

  @OneToMany(() => User, (u) => u.role)
  users: User[];
}
