// src/routes/theme.ts
import { Router } from "express";
import { AppDataSource } from "../data-source";
import { User } from "../entity/User";
import { authMiddleware } from "../middleware/auth";   // <-- ADD THIS

const router = Router();

router.use(authMiddleware); // <-- AND THIS (applies auth to all routes in this router)

const ALLOWED = ["blue", "green", "default", "orange", "red", "rose", "violet", "yellow"] as const;

// NOTE: ensureAuth must set req.user = { id: string, ... }
// adapt to your auth middleware's shape
function ensureAuth(req: any, res: any, next: any) {
    if (!req.user || !req.user.id) return res.status(401).json({ error: "unauthenticated" });
    return next();
}

router.get("/theme", ensureAuth, async (req: any, res) => {
    try {
        const repo = AppDataSource.getRepository(User);
        const user = await repo.findOne({ where: { id: req.user.id }, select: ["preferredTheme"] as any });
        return res.json({ theme: (user?.preferredTheme ?? "yellow") });
    } catch (err) {
        console.error("GET /api/user/theme error:", err);
        return res.status(500).json({ error: "internal_error" });
    }
});

router.post("/theme", ensureAuth, async (req: any, res) => {
    try {
        const { theme } = req.body ?? {};
        if (
            typeof theme !== "string" ||
            !ALLOWED.includes(theme as (typeof ALLOWED)[number])
        ) {
            return res.status(400).json({ error: "invalid_theme", allowed: ALLOWED });
        }

        const repo = AppDataSource.getRepository(User);
        await repo.update({ id: req.user.id }, { preferredTheme: theme });

        return res.json({ theme });
    } catch (err) {
        console.error("POST /api/user/theme error:", err);
        return res.status(500).json({ error: "internal_error" });
    }
});

export default router;
