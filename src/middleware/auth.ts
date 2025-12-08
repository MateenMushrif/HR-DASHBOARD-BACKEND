import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthRequest extends Request {
    user?: { id: number; email: string; name: string };
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ message: "Missing or invalid Authorization header" });
    }

    const token = authHeader.split(" ")[1];
    const secret = process.env.JWT_SECRET || "dev_secret_fallback";

    try {
        const decoded = jwt.verify(token, secret) as { id: number; email: string };
        req.user = decoded;
        next();
    } catch (err) {
        console.error("JWT verify error:", err);
        return res.status(401).json({ message: "Invalid or expired token" });
    }
}
