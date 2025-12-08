import { Router } from "express";
import { AppDataSource } from "../data-source";
import { Department } from "../entity/Department";
import { Employee } from "../entity/Employee";
import { authMiddleware } from "../middleware/auth";

const router = Router();
const deptRepo = AppDataSource.getRepository(Department);
const employeeRepo = AppDataSource.getRepository(Employee);


// GET /api/departments → list all departments
router.get("/", authMiddleware, async (req, res) => {
    try {
        const departments = await deptRepo.find({
            order: { name: "ASC" },
        });
        res.json({ departments });
    } catch (err) {
        console.error("Error fetching departments:", err);
        res.status(500).json({ message: "Failed to fetch departments" });
    }
});

// POST /api/departments → create a new department
router.post("/", authMiddleware, async (req, res) => {
    try {
        const { name, description } = req.body;

        if (!name) {
            return res.status(400).json({ message: "Department name is required" });
        }

        const exists = await deptRepo.findOne({ where: { name } });
        if (exists) {
            return res
                .status(409)
                .json({ message: "Department already exists" });
        }

        const dept = deptRepo.create({
            name,
            description: description || null,
        });

        await deptRepo.save(dept);

        res.json({ message: "Department created", department: dept });
    } catch (err) {
        console.error("Error creating department:", err);
        res.status(500).json({ message: "Failed to create department" });
    }
});

// DELETE /api/departments/:id → delete a department (if no employees)
router.delete("/:id", authMiddleware, async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (isNaN(id)) {
            return res.status(400).json({ message: "Invalid department id" });
        }

        const dept = await deptRepo.findOne({ where: { id } });
        if (!dept) {
            return res.status(404).json({ message: "Department not found" });
        }

        // Check if any employees still use this department
        const inUse = await employeeRepo.count({
            where: { department: { id } },
        });

        if (inUse > 0) {
            return res.status(409).json({
                message:
                    "Cannot delete department because employees are assigned to it",
            });
        }

        await deptRepo.remove(dept);

        res.json({ message: "Department deleted" });
    } catch (err) {
        console.error("Error deleting department:", err);
        res.status(500).json({ message: "Failed to delete department" });
    }
});

export default router;
