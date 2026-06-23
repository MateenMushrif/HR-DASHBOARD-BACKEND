import "reflect-metadata";
import express from "express";
import { AppDataSource } from "./data-source";
import { User } from "./entity/User";
import cors from "cors";
import cookieParser from "cookie-parser"
import "dotenv/config";  // this line is important
import { seedDepartments } from "./utils/seedDepartments";

import authRouter from "./routes/auth";
import departmentRouter from "./routes/department";
import employeeRouter from "./routes/employee";
import themeRouter from "./routes/theme";
import dashboardRouter from "./routes/dashboard";


import { authMiddleware, AuthRequest } from "./middleware/auth";


const app = express();
app.use(express.json());
app.use(cookieParser());


// allow Next.js frontend to call backend API
app.use(cors({
    origin: [
        "http://localhost:3000",
        "https://hrdashobodo.vercel.app"
    ], // your Next.js port
    credentials: true,
}));


// public routes
app.use("/auth", authRouter);
app.use("/api/departments", departmentRouter);
app.use("/api/employees", employeeRouter);
app.use("/api/user", themeRouter);
app.use("/api/dashboard", dashboardRouter);


// 🔐 protected route for current user
app.get("/me", authMiddleware, (req: AuthRequest, res) => {
    if (!req.user) {
        return res.status(401).json({ message: "Not authenticated" });
    }

    return res.json({
        message: "You are authenticated",
        user: req.user,
    });
});

AppDataSource.initialize()
    .then(async () => {
        console.log("Data Source has been initialized!");

        await seedDepartments();  // run the default seeds

        app.get("/users", async (_req, res) => {
            const userRepository = AppDataSource.getRepository(User);
            const users = await userRepository.find();
            res.json(users);
        });

        app.listen(3003, () => {
            console.log("Server running on http://localhost:3003");
        });
    })
    .catch((err) => {
        console.error("Error during Data Source initialization:", err);
    });
