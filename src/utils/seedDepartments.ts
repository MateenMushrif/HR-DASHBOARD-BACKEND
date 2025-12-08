import { AppDataSource } from "../data-source";
import { Department } from "../entity/Department";

export async function seedDepartments() {
    const deptRepo = AppDataSource.getRepository(Department);

    const defaultDepartments = [
        "Software Engineering",
        "AI/ML",
        "Embedded Systems",
        "Hardware",
        "Data & Analytics",
        "Sales & Marketing",
        "Intern",
    ];

    for (const name of defaultDepartments) {
        const existing = await deptRepo.findOne({ where: { name } });
        if (!existing) {
            const dept = deptRepo.create({ name });
            await deptRepo.save(dept);
        }
    }

    console.log("✅ Default departments seeded (or already existed).");
}
