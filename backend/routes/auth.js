// backend/routes/auth.js
const router  = require("express").Router();
const bcrypt  = require("bcryptjs");
const jwt     = require("jsonwebtoken");
const { getPool } = require("../config/db");

const signToken = (id, role) =>
  jwt.sign({ id, role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d"
  });

// ── POST /api/auth/register ────────────────────────────
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, role, walletAddress } = req.body;

    if (!name || !email || !password || !walletAddress) {
      return res.status(400).json({ success: false, message: "All fields required" });
    }

    const validRoles = ["borrower", "lender", "auditor", "government"];
    const userRole   = validRoles.includes(role) ? role : "borrower";

    const pool = getPool();

    // Check existing
    const [existing] = await pool.execute(
      "SELECT id FROM users WHERE email = ? OR wallet_address = ?",
      [email, walletAddress]
    );
    if (existing.length) {
      return res.status(400).json({ success: false, message: "Email or wallet already registered" });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const [result] = await pool.execute(
      "INSERT INTO users (name, email, password_hash, role, wallet_address) VALUES (?,?,?,?,?)",
      [name, email, passwordHash, userRole, walletAddress]
    );

    const token = signToken(result.insertId, userRole);
    res.status(201).json({
      success: true,
      token,
      user: { id: result.insertId, name, email, role: userRole, walletAddress }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/auth/login ───────────────────────────────
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and password required" });
    }

    const pool = getPool();
    const [rows] = await pool.execute(
      "SELECT * FROM users WHERE email = ?", [email]
    );
    if (!rows.length) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    const user  = rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    const token = signToken(user.id, user.role);
    res.json({
      success: true,
      token,
      user: {
        id:            user.id,
        name:          user.name,
        email:         user.email,
        role:          user.role,
        walletAddress: user.wallet_address,
        kycStatus:     user.kyc_status
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/auth/me ───────────────────────────────────
const { protect } = require("../middleware/auth");
router.get("/me", protect, async (req, res) => {
  res.json({ success: true, user: req.user });
});

module.exports = router;
