import { Router } from "express";
import { AppDataSource } from "../data-source";
import { User } from "../entity/User";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { authMiddleware, AuthRequest } from "../middleware/auth";


const router = Router();
const userRepo = AppDataSource.getRepository(User);

function generateToken(user: User) {
    const secret = process.env.JWT_SECRET || "dev_secret_fallback";
    console.log("Generating token with secret:", secret);

    return jwt.sign(
        { id: user.id, email: user.email, name: user.name }, // 👈 add name
        secret,
        { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    );
}


// SIGNUP
router.post("/signup", async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password)
            return res.status(400).json({ message: "Missing fields" });

        const existing = await userRepo.findOne({ where: { email } });
        if (existing)
            return res.status(409).json({ message: "Email already exists" });

        const passwordHash = await bcrypt.hash(password, 10);

        const user = userRepo.create({ name, email, passwordHash });
        await userRepo.save(user);

        const token = generateToken(user);

        res.cookie("auth_token", token, {
            httpOnly: true,
            secure: false,     // must be false on localhost
            sameSite: "lax",
            path: "/"
        });

        return res.status(201).json({
            token,
            user: { id: user.id, name: user.name, email: user.email }
        });
    } catch (err) {
        console.error("Signup error:", err); // <--- ADD THIS
        return res.status(500).json({ message: "Signup failed" });
    }
});

// LOGIN
router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await userRepo.findOne({ where: { email } });
        if (!user)
            return res.status(401).json({ message: "Invalid credentials" });

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid)
            return res.status(401).json({ message: "Invalid credentials" });

        const token = generateToken(user);

        res.cookie("auth_token", token, {
            httpOnly: true,
            secure: false,     // must be false on localhost
            sameSite: "lax",
            path: "/"
        });

        return res.json({
            token,
            user: { id: user.id, name: user.name, email: user.email }
        });
    } catch (err) {
        console.error("Login error:", err); // <--- ADD THIS
        return res.status(500).json({ message: "Login failed" });
    }
});


// LOGOUT: clear auth_token cookie
router.post("/logout", (req, res) => {
    res.clearCookie("auth_token", {
        httpOnly: true,
        secure: false,   // true in production with HTTPS
        sameSite: "lax",
        path: "/",
    });

    return res.json({ message: "Logged out" });
});


export default router;
