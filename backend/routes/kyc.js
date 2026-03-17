const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const { protect, authorize } = require("../middleware/auth");
const { getPool } = require("../config/db");
const { storeKYCOnChain, verifyKYCOnChain } = require("../config/blockchain");
const bcrypt = require("bcryptjs");

// ── Input validation helpers ──────────────────────────────
// FIX 5: Added format validation before any DB write
const GST_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
const AADHAAR_REGEX = /^[0-9]{12}$/;

function isDemoSeedAllowed() {
  // Allow in dev by default, and in prod only when explicitly enabled
  if (process.env.NODE_ENV !== "production") return true;
  return String(process.env.DEMO_SEED_ENABLED || "").toLowerCase() === "true";
}

// ── POST /api/kyc/demo/seed ───────────────────────────────
// Creates demo "pending KYC" borrowers for auditor showcase
router.post(
  "/demo/seed",
  protect,
  authorize("admin", "auditor", "government"),
  async (req, res) => {
    try {
      if (!isDemoSeedAllowed()) {
        return res.status(403).json({
          success: false,
          message: "Demo seeding is disabled. Set DEMO_SEED_ENABLED=true to allow.",
        });
      }

      const count = Math.min(10, Math.max(1, Number(req.body?.count || 3)));
      const pool = getPool();

      const passwordHash = await bcrypt.hash("demo12345", 10);

      const created = [];
      for (let i = 0; i < count; i++) {
        const suffix = crypto.randomBytes(3).toString("hex");
        const wallet = "0x" + crypto.randomBytes(20).toString("hex");
        const name = `Demo Borrower ${suffix.toUpperCase()}`;
        const email = `demo.borrower.${suffix}@example.com`;

        const businessName = `Demo MSME ${suffix.toUpperCase()}`;
        const gstNumber = `29ABCDE1234F1Z${(i % 9) + 1}`; // passes GST_REGEX
        const panNumber = `ABCDE${String(1000 + i).slice(-4)}F`; // passes PAN_REGEX
        const aadhaarNumber = `${Math.floor(100000000000 + Math.random() * 899999999999)}`; // 12 digits
        const businessType = ["Services", "Manufacturing", "Trading"][i % 3];
        const annualTurnover = 2500000 + i * 500000;

        const kycPayload = JSON.stringify({
          email,
          businessName,
          gstNumber,
          aadhaarNumber,
          panNumber,
          businessType,
          annualTurnover,
          timestamp: Date.now(),
        });
        const dataHash = crypto.createHash("sha256").update(kycPayload).digest("hex");

        // Insert user + KYC doc. If collision (rare), just skip and continue.
        let userId = null;
        try {
          const [uRes] = await pool.execute(
            "INSERT INTO users (wallet_address, name, email, password_hash, role, kyc_status) VALUES (?,?,?,?, 'borrower', 'pending')",
            [wallet, name, email, passwordHash]
          );
          userId = uRes.insertId;
        } catch (e) {
          continue;
        }

        await pool.execute(
          `INSERT INTO kyc_documents
             (user_id, business_name, gst_number, aadhaar_number, pan_number,
              business_type, annual_turnover, doc_hash, submitted_at)
           VALUES (?,?,?,?,?,?,?,?, NOW())`,
          [userId, businessName, gstNumber, aadhaarNumber, panNumber, businessType, annualTurnover, dataHash]
        );

        created.push({ id: userId, name, email, wallet_address: wallet });
      }

      return res.json({ success: true, createdCount: created.length, created });
    } catch (err) {
      console.error("demo seed error:", err);
      return res.status(500).json({ success: false, message: err.message });
    }
  }
);

// ── POST /api/kyc/submit ──────────────────────────────────
router.post("/submit", protect, async (req, res) => {
  try {
    const {
      businessName,
      gstNumber,
      aadhaarNumber,
      panNumber,
      businessType,
      annualTurnover,
    } = req.body;

    // FIX 5: Validate all required fields before touching DB
    if (!businessName || !gstNumber || !aadhaarNumber || !panNumber || !businessType || !annualTurnover) {
      return res.status(400).json({ success: false, message: "All KYC fields are required" });
    }

    const cleanAadhaar = aadhaarNumber.replace(/\s/g, "");

    if (!GST_REGEX.test(gstNumber)) {
      return res.status(400).json({ success: false, message: "Invalid GST number format (e.g. 29ABCDE1234F1Z5)" });
    }
    if (!PAN_REGEX.test(panNumber)) {
      return res.status(400).json({ success: false, message: "Invalid PAN format (e.g. ABCDE1234F)" });
    }
    if (!AADHAAR_REGEX.test(cleanAadhaar)) {
      return res.status(400).json({ success: false, message: "Aadhaar must be 12 digits" });
    }

    const pool = getPool();

    // FIX 2: Prevent silent re-submission — block if already submitted and pending/verified
    const [existing] = await pool.execute(
      "SELECT kyc_status FROM users WHERE id=?",
      [req.user.id]
    );
    if (existing.length > 0 && existing[0].kyc_status === "verified") {
      return res.status(400).json({ success: false, message: "Your KYC is already verified. No need to resubmit." });
    }
    if (existing.length > 0 && existing[0].kyc_status === "pending") {
      return res.status(400).json({ success: false, message: "Your KYC is already under review. Please wait for admin verification." });
    }

    const kycPayload = JSON.stringify({
      userId: req.user.id,
      businessName,
      gstNumber,
      aadhaarNumber: cleanAadhaar,
      panNumber,
      businessType,
      annualTurnover,
      timestamp: Date.now(),
    });

    const dataHash = crypto.createHash("sha256").update(kycPayload).digest("hex");

    // Save sensitive data OFF-CHAIN in MySQL
    // FIX 3 (from commit): ON DUPLICATE KEY UPDATE now covers all 7 fields
    // DELETE existing doc first to avoid duplicate key issues if no UNIQUE constraint
    await pool.execute("DELETE FROM kyc_documents WHERE user_id=?", [req.user.id]);

    await pool.execute(
      `INSERT INTO kyc_documents
        (user_id, business_name, gst_number, aadhaar_number, pan_number,
         business_type, annual_turnover, doc_hash, submitted_at)
       VALUES (?,?,?,?,?,?,?,?, NOW())`,
      [req.user.id, businessName, gstNumber, cleanAadhaar, panNumber, businessType, annualTurnover, dataHash]
    );

    // Update user kyc_status to pending FIRST (don't block on chain)
    await pool.execute(
      "UPDATE users SET kyc_status='pending' WHERE id=?",
      [req.user.id]
    );

    // Store ONLY the hash ON-CHAIN (non-fatal — DB is source of truth)
    // Ensure dataHash is 0x-prefixed — Web3 bytes32 validation requires it
    const dataHashHex = dataHash.startsWith("0x") ? dataHash : `0x${dataHash}`;
    let txHash = null;
    try {
      const tx = await storeKYCOnChain(req.user.wallet_address, dataHashHex, req.user.role);
      txHash = tx?.hash || null;
    } catch (chainErr) {
      console.warn("storeKYCOnChain failed (non-fatal):", chainErr.message);
    }

    // Audit log
    await pool.execute(
      `INSERT INTO audit_logs (loan_id, actor_wallet, action, details, tx_hash)
       VALUES (NULL, ?, 'KYC_SUBMITTED', ?, ?)`,
      [req.user.wallet_address, JSON.stringify({ businessName, gstNumber }), txHash]
    );

    res.json({
      success: true,
      message: "KYC submitted successfully. Awaiting verification.",
      txHash,
      dataHash,
    });
  } catch (err) {
    console.error("KYC submit error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/kyc/status ───────────────────────────────────
router.get("/status", protect, async (req, res) => {
  try {
    const pool = getPool();
    const [users] = await pool.execute(
      "SELECT kyc_status FROM users WHERE id=?",
      [req.user.id]
    );
    if (!users.length) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    const [docs] = await pool.execute(
      "SELECT business_name, gst_number, submitted_at, verified_at, doc_hash FROM kyc_documents WHERE user_id=?",
      [req.user.id]
    );
    res.json({
      success: true,
      kyc_status: users[0].kyc_status,
      document: docs[0] || null,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/kyc/pending ──────────────────────────────────
// FIX 1 (from commit): Added "auditor" and "government" to authorize()
// FIX 4 (from commit): SELECT now returns all 8 KYC fields
// FIX 3 (new): Added pagination via LIMIT/OFFSET to prevent huge result sets
router.get("/pending", protect, authorize("admin", "auditor", "government"), async (req, res) => {
  try {
    const pool = getPool();

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 20);
    const offset = (page - 1) * limit;

    // Backfill submitted_at for any existing rows that were inserted before this fix
    await pool.execute(
      "UPDATE kyc_documents SET submitted_at = NOW() WHERE submitted_at IS NULL"
    );

    const statusFilter = req.query.status;
    // Default: show ONLY real submissions that are pending verification.
    // Require a doc_hash so "new users with default status" never show up here.
    let whereClause = "WHERE u.kyc_status = 'pending' AND k.doc_hash IS NOT NULL";
    let queryParams = [limit, offset];
    let countParams = [];

    if (statusFilter && statusFilter !== 'all') {
      whereClause = "WHERE u.kyc_status = ? AND k.doc_hash IS NOT NULL";
      queryParams = [statusFilter, limit, offset];
      countParams = [statusFilter];
    } else if (statusFilter === 'all') {
      // Still require doc_hash so only actual submissions appear
      whereClause = "WHERE u.kyc_status IN ('pending', 'verified', 'rejected') AND k.doc_hash IS NOT NULL";
    }

    // LEFT JOIN so users with pending status but missing kyc_doc row still appear
    const [rows] = await pool.execute(
      `SELECT
         u.id,
         u.name,
         u.email,
         u.wallet_address,
         u.role,
         k.business_name,
         k.gst_number,
         k.aadhaar_number,
         k.pan_number,
         k.business_type,
         k.annual_turnover,
         k.doc_hash,
         k.submitted_at
       FROM users u
       LEFT JOIN kyc_documents k ON k.user_id = u.id
       ${whereClause}
       ORDER BY COALESCE(k.submitted_at, u.created_at) DESC
       LIMIT ? OFFSET ?`,
      queryParams
    );

    const [[{ total }]] = await pool.execute(
      `SELECT COUNT(*) AS total
       FROM users u
       LEFT JOIN kyc_documents k ON k.user_id = u.id
       ${whereClause}`,
      countParams
    );

    res.json({ success: true, pending: rows, total, page, limit });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/kyc/verify/:userId ──────────────────────────
// FIX 2 (from commit): Added "auditor" to authorize()
router.post("/verify/:userId", protect, authorize("admin", "auditor"), async (req, res) => {
  try {
    const { status } = req.body; // "verified" or "rejected"
    const { userId } = req.params;

    if (!["verified", "rejected"].includes(status)) {
      return res.status(400).json({ success: false, message: "Status must be 'verified' or 'rejected'" });
    }

    const pool = getPool();
    const [users] = await pool.execute(
      "SELECT wallet_address, kyc_status FROM users WHERE id=?",
      [userId]
    );
    if (!users.length) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    if (users[0].kyc_status !== "pending") {
      return res.status(400).json({ success: false, message: `KYC is already '${users[0].kyc_status}'` });
    }

    const wallet = users[0].wallet_address;

    // Update MySQL first — don't let a blockchain hiccup block the admin action
    await pool.execute(
      "UPDATE users SET kyc_status=? WHERE id=?",
      [status, userId]
    );
    await pool.execute(
      "UPDATE kyc_documents SET verified_at=NOW() WHERE user_id=?",
      [userId]
    );

    // Update blockchain (non-fatal if it fails)
    let txHash = null;
    try {
      const tx = await verifyKYCOnChain(wallet, status === "verified");
      txHash = tx?.hash || null;
    } catch (chainErr) {
      console.warn("verifyKYCOnChain failed (non-fatal):", chainErr.message);
    }

    // Audit log
    await pool.execute(
      `INSERT INTO audit_logs (actor_wallet, action, details, tx_hash)
       VALUES (?, 'KYC_VERIFIED', ?, ?)`,
      [req.user.wallet_address, JSON.stringify({ userId, status }), txHash]
    );

    res.json({ success: true, message: `KYC ${status} successfully`, txHash });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;