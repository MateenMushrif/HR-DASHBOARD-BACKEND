import { Router } from "express";
import { AppDataSource } from "../data-source";
import { Employee } from "../entity/Employee";
import { Department } from "../entity/Department";
import { authMiddleware } from "../middleware/auth";

const router = Router();
const employeeRepo = AppDataSource.getRepository(Employee);

// GET /api/employees → list all employees
router.get("/", authMiddleware, async (req, res) => {
    try {
        const employees = await employeeRepo.find({
            relations: ["department"],
            order: { id: "ASC" },
        });

        res.json({ employees });
    } catch (err) {
        console.error("Error fetching employees:", err);
        res.status(500).json({ message: "Failed to fetch employees" });
    }
});


// GET /api/employees/stats/hires-last-6-months
router.get("/stats/hires-last-6-months", authMiddleware, async (req, res) => {
    try {
        const now = new Date();

        // Start from the 1st day of the month, 5 months ago (so total = 6 months including current)
        const start = new Date(now.getFullYear(), now.getMonth() - 5, 1);

        // Aggregate by month using Postgres DATE_TRUNC
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

        type MonthlyCounts = { employees: number; interns: number };

        // Normalize raw rows into a year-month map
        const map = new Map<string, MonthlyCounts>();

        for (const row of raw as any[]) {
            const monthDate = new Date(row.month);
            const key = `${monthDate.getFullYear()}-${monthDate.getMonth()}`; // e.g. "2025-0" for Jan 2025

            map.set(key, {
                employees: Number(row.employees) || 0,
                interns: Number(row.interns) || 0,
            });
        }

        // Build a continuous 6-month timeline (even if some months have 0 hires)
        const points: { month: string; employees: number; interns: number }[] = [];

        for (let i = 0; i < 6; i++) {
            const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
            const key = `${d.getFullYear()}-${d.getMonth()}`;
            const counts = map.get(key) ?? { employees: 0, interns: 0 };

            const label = d.toLocaleString("default", { month: "short" }); // "Jan", "Feb", ...

            points.push({
                month: label,
                employees: counts.employees,
                interns: counts.interns,
            });
        }

        return res.json({ points });
    } catch (err) {
        console.error("Error computing hires-last-6-months:", err);
        return res.status(500).json({ message: "Failed to load hires stats" });
    }
});


// GET /api/employees/:id → get single employee
router.get("/:id", authMiddleware, async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (isNaN(id)) {
            return res.status(400).json({ message: "Invalid employee id" });
        }

        const employee = await employeeRepo.findOne({
            where: { id },
            relations: ["department"],
        });

        if (!employee) {
            return res.status(404).json({ message: "Employee not found" });
        }

        res.json({ employee });
    } catch (err) {
        console.error("Error fetching employee:", err);
        res.status(500).json({ message: "Failed to fetch employee" });
    }
});

// POST /api/employees → create a new employee
router.post("/", authMiddleware, async (req, res) => {
    try {
        const {
            firstName,
            lastName,
            email,
            phone,
            role,
            departmentId,
            status,
            dateOfJoining,
            salary,
            isIntern,
        } = req.body;

        if (!firstName || !lastName || !email) {
            return res.status(400).json({ message: "Missing required fields" });
        }

        const existing = await employeeRepo.findOne({ where: { email } });
        if (existing) {
            return res
                .status(409)
                .json({ message: "Employee with this email already exists" });
        }

        let department: Department | null = null;
        if (departmentId) {
            const deptRepo = AppDataSource.getRepository(Department);
            const foundDept = await deptRepo.findOne({
                where: { id: Number(departmentId) },
            });
            if (!foundDept) {
                return res.status(400).json({ message: "Invalid departmentId" });
            }
            department = foundDept;
        }

        const employee = employeeRepo.create({
            firstName,
            lastName,
            email,
            phone: phone || null,
            role: role || null,
            department,
            status: status || "ACTIVE",
            dateOfJoining: dateOfJoining || null,
            salary: salary || null,
            isIntern: !!isIntern,
        });

        await employeeRepo.save(employee);

        res.json({ message: "Employee created", employee });
    } catch (err) {
        console.error("Error creating employee:", err);
        res.status(500).json({ message: "Failed to create employee" });
    }
});

// PUT /api/employees/:id → update an employee
router.put("/:id", authMiddleware, async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (isNaN(id)) {
            return res.status(400).json({ message: "Invalid employee id" });
        }

        const {
            firstName,
            lastName,
            email,
            phone,
            role,
            departmentId,
            status,
            dateOfJoining,
            salary,
            isIntern,
        } = req.body;

        const employee = await employeeRepo.findOne({
            where: { id },
            relations: ["department"],
        });

        if (!employee) {
            return res.status(404).json({ message: "Employee not found" });
        }

        // email uniqueness
        if (email && email !== employee.email) {
            const existing = await employeeRepo.findOne({ where: { email } });
            if (existing) {
                return res
                    .status(409)
                    .json({ message: "Another employee with this email already exists" });
            }
            employee.email = email;
        }

        if (firstName) employee.firstName = firstName;
        if (lastName) employee.lastName = lastName;
        if (phone !== undefined) employee.phone = phone || null;
        if (role !== undefined) employee.role = role || null;
        if (status) employee.status = status;
        if (dateOfJoining !== undefined)
            employee.dateOfJoining = dateOfJoining || null;
        if (salary !== undefined) employee.salary = salary || null;

        if (isIntern !== undefined) {
            employee.isIntern = !!isIntern;
        }

        if (departmentId !== undefined) {
            if (!departmentId) {
                employee.department = null;
            } else {
                const deptRepo = AppDataSource.getRepository(Department);
                const dept = await deptRepo.findOne({
                    where: { id: Number(departmentId) },
                });
                if (!dept) {
                    return res.status(400).json({ message: "Invalid departmentId" });
                }
                employee.department = dept;
            }
        }

        await employeeRepo.save(employee);

        res.json({ message: "Employee updated", employee });
    } catch (err) {
        console.error("Error updating employee:", err);
        res.status(500).json({ message: "Failed to update employee" });
    }
});

// PATCH /api/employees/:id/status → change employee status (ACTIVE/INACTIVE/ON_LEAVE)
router.patch("/:id/status", authMiddleware, async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (isNaN(id)) {
            return res.status(400).json({ message: "Invalid employee id" });
        }

        const { status } = req.body;

        if (!status) {
            return res.status(400).json({ message: "Status is required" });
        }

        const allowed = ["ACTIVE", "INACTIVE", "ON_LEAVE"];
        if (!allowed.includes(status)) {
            return res
                .status(400)
                .json({ message: "Invalid status value", allowed });
        }

        const employee = await employeeRepo.findOne({ where: { id } });
        if (!employee) {
            return res.status(404).json({ message: "Employee not found" });
        }

        employee.status = status;
        await employeeRepo.save(employee);

        res.json({ message: "Status updated", employee });
    } catch (err) {
        console.error("Error updating employee status:", err);
        res.status(500).json({ message: "Failed to update employee status" });
    }
});

export default router;
