const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const { protect, authorize } = require("../middleware/auth");
const { getPool } = require("../config/db");
const { storeKYCOnChain, verifyKYCOnChain } = require("../config/blockchain");

// ── Input validation helpers ──────────────────────────────
// FIX 5: Added format validation before any DB write
const GST_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
const AADHAAR_REGEX = /^[0-9]{12}$/;

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
    const [result] = await pool.execute(
      `INSERT INTO kyc_documents
        (user_id, business_name, gst_number, aadhaar_number, pan_number,
         business_type, annual_turnover, doc_hash)
       VALUES (?,?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE
         business_name    = VALUES(business_name),
         gst_number       = VALUES(gst_number),
         aadhaar_number   = VALUES(aadhaar_number),
         pan_number       = VALUES(pan_number),
         business_type    = VALUES(business_type),
         annual_turnover  = VALUES(annual_turnover),
         doc_hash         = VALUES(doc_hash)`,
      [req.user.id, businessName, gstNumber, cleanAadhaar, panNumber, businessType, annualTurnover, dataHash]
    );

    // Store ONLY the hash ON-CHAIN (privacy preserved)
    const tx = await storeKYCOnChain(req.user.wallet_address, dataHash, req.user.role);

    // Update user kyc_status to pending
    await pool.execute(
      "UPDATE users SET kyc_status='pending' WHERE id=?",
      [req.user.id]
    );

    // Audit log
    await pool.execute(
      `INSERT INTO audit_logs (loan_id, actor_wallet, action, details, tx_hash)
       VALUES (NULL, ?, 'KYC_SUBMITTED', ?, ?)`,
      [req.user.wallet_address, JSON.stringify({ businessName, gstNumber }), tx?.hash || null]
    );

    res.json({
      success: true,
      message: "KYC submitted successfully. Awaiting verification.",
      txHash: tx?.hash,
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
       JOIN kyc_documents k ON k.user_id = u.id
       WHERE u.kyc_status = 'pending'
       ORDER BY k.submitted_at DESC
       LIMIT ? OFFSET ?`,
      [limit, offset]
    );

    const [[{ total }]] = await pool.execute(
      "SELECT COUNT(*) AS total FROM users WHERE kyc_status='pending'"
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

    // Update blockchain
    const tx = await verifyKYCOnChain(wallet, status === "verified");

    // Update MySQL
    await pool.execute(
      "UPDATE users SET kyc_status=? WHERE id=?",
      [status, userId]
    );
    await pool.execute(
      "UPDATE kyc_documents SET verified_at=NOW() WHERE user_id=?",
      [userId]
    );

    // Audit log
    await pool.execute(
      `INSERT INTO audit_logs (actor_wallet, action, details, tx_hash)
       VALUES (?, 'KYC_VERIFIED', ?, ?)`,
      [req.user.wallet_address, JSON.stringify({ userId, status }), tx?.hash || null]
    );

    res.json({ success: true, message: `KYC ${status} successfully`, txHash: tx?.hash });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
