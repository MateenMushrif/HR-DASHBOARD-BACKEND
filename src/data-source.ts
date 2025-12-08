import "reflect-metadata";
import { DataSource } from "typeorm";
import { User } from "./entity/User";
import { Employee } from "./entity/Employee";
import { Department } from "./entity/Department";
import "dotenv/config";  // this line is important

export const AppDataSource = new DataSource({
    type: "postgres",
    url: process.env.DATABASE_URL, // <- Neon connection string
    entities: [User, Employee, Department],
    synchronize: true,
    logging: true,
    ssl: true, // Neon requires SSL
});
