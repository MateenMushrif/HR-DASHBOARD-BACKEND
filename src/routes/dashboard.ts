import { Router } from "express";
import { AppDataSource } from "../data-source";
import { Employee } from "../entity/Employee";
import { Department } from "../entity/Department";
import { authMiddleware } from "../middleware/auth";

const router = Router();
const employeeRepo = AppDataSource.getRepository(Employee);
const departmentRepo = AppDataSource.getRepository(Department);

router.get("/", authMiddleware, async (_req, res) => {
    try {
        // 1️⃣ Fetch all employees once
        const employees = await employeeRepo.find({
            relations: ["department"],
        });

        // 2️⃣ Basic counts
        const totalEmployees = employees.length;
        const internsCount = employees.filter(e => e.isIntern).length;

        const onLeaveCount = employees.filter(e => e.status === "ON_LEAVE").length;

        const onLeaveEmployees = employees
            .filter(e => e.status === "ON_LEAVE")
            .map(e => ({
                id: e.id,
                firstName: e.firstName,
                lastName: e.lastName,
                role: e.role ?? null,
                department: e.department?.name ?? null,
            }));

        // 3️⃣ Department counts
        const departmentMap = new Map<string, number>();

        for (const emp of employees) {
            const deptName =
                emp.department?.name ?? "Unknown";

            departmentMap.set(
                deptName,
                (departmentMap.get(deptName) || 0) + 1
            );
        }

        const departmentCounts = Array.from(departmentMap.entries()).map(
            ([department, count]) => ({
                department,
                count,
            })
        );

        // 4️⃣ Hires last 6 months (same logic you already use)
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth() - 5, 1);

        const raw = await employeeRepo
            .createQueryBuilder("e")
            .select(`DATE_TRUNC('month', e."dateOfJoining")`, "month")
            .addSelect(
                `SUM(CASE WHEN e."isIntern" = true THEN 1 ELSE 0 END)`,
                "interns"
            )
            .addSelect(
                `SUM(CASE WHEN (e."isIntern" = false OR e."isIntern" IS NULL) THEN 1 ELSE 0 END)`,
                "employees"
            )
            .where(`e."dateOfJoining" IS NOT NULL`)
            .andWhere(`e."dateOfJoining" >= :start`, { start })
            .groupBy("month")
            .orderBy("month", "ASC")
            .getRawMany();

        const hiresLast6Months = raw.map(row => ({
            month: new Date(row.month).toLocaleString("default", { month: "short" }),
            employees: Number(row.employees) || 0,
            interns: Number(row.interns) || 0,
        }));

        return res.json({
            totalEmployees,
            internsCount,
            onLeaveCount,
            onLeaveEmployees,
            departmentCounts,
            hiresLast6Months,
        });

    } catch (err) {
        console.error("Dashboard error:", err);
        return res.status(500).json({ message: "Failed to load dashboard data" });
    }
});

export default router;