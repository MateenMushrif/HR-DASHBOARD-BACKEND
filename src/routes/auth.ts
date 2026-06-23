import { Router } from "express";
import { AppDataSource } from "../data-source";
import { User } from "../entity/User";
import bcrypt from "bcryptjs";
import jwt, { type Secret, type SignOptions } from "jsonwebtoken";

const router = Router();
const userRepo = AppDataSource.getRepository(User);

function generateToken(user: User): string {
    const secret: Secret =
        process.env.JWT_SECRET ?? "dev_secret_fallback";

    const options: SignOptions = {
        expiresIn: Number(process.env.JWT_EXPIRES_IN) || 60 * 60 * 24 * 7,
    };

    return jwt.sign(
        { id: user.id, email: user.email, name: user.name },
        secret,
        options
    );
}

// SIGNUP
router.post("/signup", async (req, res) => {
    try {
        const { name, email, password } = req.body as {
            name?: string;
            email?: string;
            password?: string;
        };

        if (!name || !email || !password) {
            return res.status(400).json({ message: "Missing fields" });
        }

        const existing = await userRepo.findOne({ where: { email } });
        if (existing) {
            return res.status(409).json({ message: "Email already exists" });
        }

        const passwordHash = await bcrypt.hash(password, 10);

        const user = userRepo.create({ name, email, passwordHash });
        await userRepo.save(user);

        const token = generateToken(user);

        res.cookie("auth_token", token, {
            httpOnly: true,
            secure: true,
            sameSite: "none",
            path: "/",
        });

        return res.status(201).json({
            token,
            user: { id: user.id, name: user.name, email: user.email },
        });
    } catch (err) {
        console.error("Signup error:", err);
        return res.status(500).json({ message: "Signup failed" });
    }
});

// LOGIN
router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body as {
            email?: string;
            password?: string;
        };

        if (!email || !password) {
            return res.status(400).json({ message: "Missing credentials" });
        }

        const user = await userRepo.findOne({ where: { email } });
        if (!user) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) {
            return res.status(401).json({ message: "Invalid password" });
        }

        const token = generateToken(user);

        res.cookie("auth_token", token, {
            httpOnly: true,
            secure: true,
            sameSite: "none",
            path: "/",
        });

        return res.json({
            token,
            user: { id: user.id, name: user.name, email: user.email },
        });
    } catch (err) {
        console.error("Login error:", err);
        return res.status(500).json({ message: "Login failed" });
    }
});

// LOGOUT
router.post("/logout", (req, res) => {
    res.clearCookie("auth_token", {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        path: "/",
    });

    return res.json({ message: "Logged out" });
});

export default router;
