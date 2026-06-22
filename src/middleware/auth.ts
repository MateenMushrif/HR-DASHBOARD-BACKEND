import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthRequest extends Request {
    user?: { id: number; email: string; name?: string };
}

export function authMiddleware(
    req: AuthRequest,
    res: Response,
    next: NextFunction
) {
    // 1️⃣ Try cookie-based auth first
    const cookieToken = req.cookies?.auth_token;

    // 2️⃣ Fallback to Authorization header (legacy support)
    const headerToken =
        req.headers.authorization?.startsWith("Bearer ")
            ? req.headers.authorization.split(" ")[1]
            : null;

    const token = cookieToken || headerToken;

    if (!token) {
        return res.status(401).json({ message: "Not authenticated" });
    }

    const secret = process.env.JWT_SECRET || "dev_secret_fallback";

    try {
        const decoded = jwt.verify(token, secret) as {
            id: number;
            email: string;
            name?: string;
        };

        req.user = decoded;
        next();
    } catch (err) {
        console.error("JWT verify error:", err);
        return res.status(401).json({ message: "Invalid or expired token" });
    }
}
