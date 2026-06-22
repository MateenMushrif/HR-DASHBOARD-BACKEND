import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    ManyToOne,
    CreateDateColumn,
    UpdateDateColumn,
} from "typeorm";
import { Department } from "./Department";
import { Index } from "typeorm";

@Index(["department", "isIntern"])
@Entity()
export class Employee {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column()
    firstName!: string;

    @Column()
    lastName!: string;

    @Column({ unique: true })
    email!: string;

    @Column({ nullable: true })
    phone?: string;

    @Column({ nullable: true })
    role?: string;

    @Column({ default: false })
    isIntern!: boolean;  // <-- NEW COLUMN

    @Index()
    @ManyToOne(() => Department, { nullable: true, onDelete: "SET NULL" })
    department!: Department | null;

    @Column({ default: "ACTIVE" })
    status!: string;

    @Index()
    @Column({ type: "date", nullable: true })
    dateOfJoining!: string | null;

    @Column({ type: "numeric", precision: 10, scale: 2, nullable: true })
    salary?: string;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;
}
