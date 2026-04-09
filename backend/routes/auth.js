import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { getPool } from "../config/db.js";

const router = Router();

const signToken = (id, role) =>
  jwt.sign({ id, role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });

// REGISTER
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, role, walletAddress } = req.body;

    if (!name || !email || !password || !walletAddress) {
      return res.status(400).json({ success: false });
    }

    const pool = getPool();

    const existingRes = await pool.query(
      "SELECT id FROM users WHERE email=$1 OR wallet_address=$2",
      [email, walletAddress]
    );

    if (existingRes.rows.length) {
      return res.status(400).json({ success: false, message: "User exists" });
    }

    const hash = await bcrypt.hash(password, 12);

    const result = await pool.query(
      "INSERT INTO users (name,email,password_hash,role,wallet_address) VALUES ($1,$2,$3,$4,$5) RETURNING id",
      [name, email, hash, role || "borrower", walletAddress]
    );

    const userId = result.rows[0].id;
    const token = signToken(userId, role);

    res.json({ success: true, token });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// LOGIN
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const pool = getPool();

    const result = await pool.query(
      "SELECT * FROM users WHERE email=$1",
      [email]
    );

    const user = result.rows[0];

    if (!user) return res.status(401).json({ success: false });

    const match = await bcrypt.compare(password, user.password_hash);

    if (!match) return res.status(401).json({ success: false });

    const token = signToken(user.id, user.role);

    res.json({ success: true, token, user });
  } catch {
    res.status(500).json({ success: false });
  }
});

export default router;