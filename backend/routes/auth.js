import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { getPool } from "../config/db.js";
import { protect } from "../middleware/auth.js";

const router = Router();

// Generate JWT
const signToken = (id, role) =>
  jwt.sign({ id, role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });

function sanitizeUser(row) {
  if (!row) return null;
  // Explicitly pick fields to avoid leaking password_hash or other columns.
  return {
    id: row.id,
    wallet_address: row.wallet_address,
    name: row.name,
    email: row.email,
    role: row.role,
    kyc_status: row.kyc_status,
    created_at: row.created_at,
  };
}

/* =========================
   REGISTER
========================= */
router.post("/register", async (req, res) => {
  try {
    console.log("Incoming register data:", req.body);

    const { name, email, password, role, walletAddress } = req.body;

    // Validate input
    if (!name || !email || !password || !walletAddress) {
      return res.status(400).json({
        success: false,
        message: "All fields required: name, email, password, walletAddress",
      });
    }

    const pool = getPool();

    // Check existing user
    const existingRes = await pool.query(
      "SELECT id FROM users WHERE email=$1 OR wallet_address=$2",
      [email, walletAddress]
    );

    if (existingRes.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: "User already exists (email or wallet)",
      });
    }

    // Hash password
    const hash = await bcrypt.hash(password, 12);

    // Insert user
    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, wallet_address)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, role`,
      [name, email, hash, role || "borrower", walletAddress]
    );

    const user = result.rows[0];

    // Generate token
    const token = signToken(user.id, user.role);

    const userRes = await pool.query(
      "SELECT id, wallet_address, name, email, role, kyc_status, created_at FROM users WHERE id=$1",
      [user.id]
    );

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      token,
      userId: user.id,
      user: sanitizeUser(userRes.rows[0]),
    });

  } catch (err) {
    console.error("REGISTER ERROR:", err);

    res.status(500).json({
      success: false,
      message: err.message || "Server error",
    });
  }
});

/* =========================
   LOGIN
========================= */
router.post("/login", async (req, res) => {
  try {
    console.log("Incoming login data:", req.body);

    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password required",
      });
    }

    const pool = getPool();

    const result = await pool.query(
      "SELECT id, wallet_address, name, email, password_hash, role, kyc_status, created_at FROM users WHERE email=$1",
      [email]
    );

    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    const match = await bcrypt.compare(password, user.password_hash);

    if (!match) {
      return res.status(401).json({
        success: false,
        message: "Invalid password",
      });
    }

    const token = signToken(user.id, user.role);

    res.json({
      success: true,
      message: "Login successful",
      token,
      user: sanitizeUser(user),
    });

  } catch (err) {
    console.error("LOGIN ERROR:", err);

    res.status(500).json({
      success: false,
      message: err.message || "Server error",
    });
  }
});

/* =========================
   CURRENT USER (ME)
========================= */
router.get("/me", protect, async (req, res) => {
  // protect already loads a safe subset of fields into req.user
  res.json({ success: true, user: sanitizeUser(req.user) });
});

export default router;