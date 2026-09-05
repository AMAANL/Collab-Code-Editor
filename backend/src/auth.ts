import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomUUID } from "crypto";
import { db } from "./database.js";

const JWT_SECRET = process.env.JWT_SECRET || "super-secret-collab-key";

export const authRouter = express.Router();

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
}

// Middleware to verify JWT token
export function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid authorization header" });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;
    (req as any).user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

// Register
authRouter.post("/register", async (req, res) => {
  const { email, password, displayName } = req.body;
  
  if (!email || !password || !displayName) {
    return res.status(400).json({ error: "Email, password, and display name are required" });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const id = randomUUID();
    
    const stmt = db.prepare("INSERT INTO users (id, email, password_hash, display_name) VALUES (?, ?, ?, ?)");
    stmt.run(id, email, passwordHash, displayName);

    const token = jwt.sign({ id, email, displayName }, JWT_SECRET, { expiresIn: "7d" });
    res.status(201).json({ token, user: { id, email, displayName } });
  } catch (err: any) {
    if (err.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return res.status(400).json({ error: "Email already in use" });
    }
    console.error("Register error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Login
authRouter.post("/login", async (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  try {
    const stmt = db.prepare("SELECT * FROM users WHERE email = ?");
    const user = stmt.get(email) as any;

    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const authUser: AuthUser = { id: user.id, email: user.email, displayName: user.display_name };
    const token = jwt.sign(authUser, JWT_SECRET, { expiresIn: "7d" });
    
    res.json({ token, user: authUser });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get current user
authRouter.get("/me", requireAuth, (req, res) => {
  res.json({ user: (req as any).user });
});
