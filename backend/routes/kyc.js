// backend/routes/kyc.js
const router  = require("express").Router();
const crypto  = require("crypto");
const { getPool }            = require("../config/db");
const { protect, authorize } = require("../middleware/auth");
const { storeKYCOnChain, verifyKYCOnChain } = require("../config/blockchain");

// ── POST /api/kyc/submit ───────────────────────────────
// Borrower or Lender submits KYC documents
router.post("/submit", protect, async (req, res) => {
  try {
    const {
      businessName, gstNumber, aadhaarNumber,
      panNumber, businessType, annualTurnover
    } = req.body;

    if (!gstNumber || !aadhaarNumber) {
      return res.status(400).json({
        success: false, message: "GST number and Aadhaar are required"
      });
    }

    // Create a deterministic hash of KYC data (stored on blockchain)
    const kycPayload = JSON.stringify({
      userId: req.user.id,
      businessName, gstNumber, aadhaarNumber, panNumber,
      businessType, annualTurnover
    });
    const dataHash = "0x" + crypto.createHash("sha256")
      .update(kycPayload).digest("hex");

    const pool = getPool();

    // Save sensitive data OFF-CHAIN in MySQL
    const [result] = await pool.execute(`
      INSERT INTO kyc_documents
        (user_id, business_name, gst_number, aadhaar_number, pan_number,
         business_type, annual_turnover, doc_hash)
      VALUES (?,?,?,?,?,?,?,?)
      ON DUPLICATE KEY UPDATE
        business_name=VALUES(business_name),
        gst_number=VALUES(gst_number),
        doc_hash=VALUES(doc_hash)
    `, [
      req.user.id, businessName, gstNumber, aadhaarNumber,
      panNumber, businessType, annualTurnover, dataHash
    ]);

    // Store ONLY the hash ON-CHAIN (privacy preserved)
    const tx = await storeKYCOnChain(req.user.wallet_address, dataHash, req.user.role);

    // Update user kyc_status to pending
    await pool.execute(
      "UPDATE users SET kyc_status='pending' WHERE id=?", [req.user.id]
    );

    // Audit log
    await pool.execute(`
      INSERT INTO audit_logs (loan_id, actor_wallet, action, details, tx_hash)
      VALUES (NULL, ?, 'KYC_SUBMITTED', ?, ?)
    `, [req.user.wallet_address, JSON.stringify({ dataHash }), tx.transactionHash]);

    res.status(201).json({
      success: true,
      message: "KYC submitted. Awaiting admin verification.",
      dataHash,
      txHash: tx.transactionHash
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/kyc/status ────────────────────────────────
router.get("/status", protect, async (req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.execute(
      "SELECT kyc_status FROM users WHERE id=?", [req.user.id]
    );
    res.json({ success: true, kycStatus: rows[0]?.kyc_status || "not_submitted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/kyc/pending ───────────────────────────────
// Admin sees all pending KYC requests
router.get("/pending", protect, authorize("admin"), async (req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.execute(`
      SELECT u.id, u.name, u.email, u.wallet_address, u.role,
             k.business_name, k.gst_number, k.doc_hash, k.submitted_at
      FROM users u
      JOIN kyc_documents k ON k.user_id = u.id
      WHERE u.kyc_status = 'pending'
    `);
    res.json({ success: true, pending: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/kyc/verify/:userId ──────────────────────
// Admin approves or rejects KYC
router.post("/verify/:userId", protect, authorize("admin"), async (req, res) => {
  try {
    const { status } = req.body;  // "verified" or "rejected"
    const { userId } = req.params;

    if (!["verified", "rejected"].includes(status)) {
      return res.status(400).json({ success: false, message: "Status must be verified or rejected" });
    }

    const pool = getPool();
    const [users] = await pool.execute(
      "SELECT wallet_address FROM users WHERE id=?", [userId]
    );
    if (!users.length) {
      return res.status(404).json({ success: false, message: "User not found" });
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
      "UPDATE kyc_documents SET verified_at=NOW() WHERE user_id=?", [userId]
    );

    // Audit log
    await pool.execute(`
      INSERT INTO audit_logs (actor_wallet, action, details, tx_hash)
      VALUES (?, 'KYC_VERIFIED', ?, ?)
    `, [req.user.wallet_address, JSON.stringify({ userId, status }), tx.transactionHash]);

    res.json({ success: true, message: `KYC ${status}`, txHash: tx.transactionHash });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
