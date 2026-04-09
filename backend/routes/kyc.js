import { Router } from "express";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { protect, authorize } from "../middleware/auth.js";
import { getPool } from "../config/db.js";
import { storeKYCOnChain, verifyKYCOnChain } from "../config/blockchain.js";

const router = Router();

const GST_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
const AADHAAR_REGEX = /^[0-9]{12}$/;

function isDemoSeedAllowed() {
  if (process.env.NODE_ENV !== "production") return true;
  return String(process.env.DEMO_SEED_ENABLED || "").toLowerCase() === "true";
}

// DEMO SEED
router.post("/demo/seed", protect, authorize("admin", "auditor", "government"), async (req, res) => {
  try {
    if (!isDemoSeedAllowed()) {
      return res.status(403).json({ success: false, message: "Demo disabled" });
    }

    const count = Math.min(10, Math.max(1, Number(req.body?.count || 3)));
    const pool = getPool();
    const passwordHash = await bcrypt.hash("demo12345", 10);
    const created = [];

    for (let i = 0; i < count; i++) {
      const suffix = crypto.randomBytes(3).toString("hex");
      const wallet = "0x" + crypto.randomBytes(20).toString("hex");
      const name = `Demo Borrower ${suffix}`;
      const email = `demo.${suffix}@example.com`;

      let userId;
      try {
        const userRes = await pool.query(
          "INSERT INTO users (wallet_address, name, email, password_hash, role, kyc_status) VALUES ($1,$2,$3,$4,'borrower','pending') RETURNING id",
          [wallet, name, email, passwordHash]
        );
        userId = userRes.rows[0].id;
      } catch {
        continue;
      }

      const dataHash = crypto.createHash("sha256").update(email).digest("hex");

      await pool.query(
        `INSERT INTO kyc_documents
         (user_id, business_name, gst_number, aadhaar_number, pan_number,
          business_type, annual_turnover, doc_hash, submitted_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,CURRENT_TIMESTAMP)`,
        [userId, "Demo Biz", "29ABCDE1234F1Z5", "123456789012", "ABCDE1234F", "Services", 1000000, dataHash]
      );

      created.push({ id: userId, name, email });
    }

    res.json({ success: true, created });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// SUBMIT KYC
router.post("/submit", protect, async (req, res) => {
  try {
    const { businessName, gstNumber, aadhaarNumber, panNumber, businessType, annualTurnover } = req.body;

    if (!businessName || !gstNumber || !aadhaarNumber || !panNumber) {
      return res.status(400).json({ success: false, message: "All fields required" });
    }

    if (!GST_REGEX.test(gstNumber)) return res.status(400).json({ success: false, message: "Invalid GST" });
    if (!PAN_REGEX.test(panNumber)) return res.status(400).json({ success: false, message: "Invalid PAN" });
    if (!AADHAAR_REGEX.test(aadhaarNumber)) return res.status(400).json({ success: false, message: "Invalid Aadhaar" });

    const pool = getPool();

    const existingRes = await pool.query(
      "SELECT kyc_status FROM users WHERE id=$1",
      [req.user.id]
    );

    if (existingRes.rows[0]?.kyc_status === "verified") {
      return res.status(400).json({ success: false, message: "Already verified" });
    }

    const dataHash = crypto.createHash("sha256").update(JSON.stringify(req.body)).digest("hex");

    await pool.query("DELETE FROM kyc_documents WHERE user_id=$1", [req.user.id]);

    await pool.query(
      `INSERT INTO kyc_documents
       (user_id, business_name, gst_number, aadhaar_number, pan_number,
        business_type, annual_turnover, doc_hash, submitted_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,CURRENT_TIMESTAMP)`,
      [req.user.id, businessName, gstNumber, aadhaarNumber, panNumber, businessType, annualTurnover, dataHash]
    );

    await pool.query(
      "UPDATE users SET kyc_status='pending' WHERE id=$1",
      [req.user.id]
    );

    let txHash = null;
    try {
      const tx = await storeKYCOnChain(req.user.wallet_address, "0x" + dataHash, req.user.role);
      txHash = tx?.hash;
    } catch {}

    await pool.query(
      `INSERT INTO audit_logs (actor_wallet, action, details, tx_hash)
       VALUES ($1,'KYC_SUBMITTED',$2,$3)`,
      [req.user.wallet_address, JSON.stringify({ businessName }), txHash]
    );

    res.json({ success: true, txHash });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// STATUS
router.get("/status", protect, async (req, res) => {
  try {
    const pool = getPool();

    const userRes = await pool.query(
      "SELECT kyc_status FROM users WHERE id=$1",
      [req.user.id]
    );

    const docRes = await pool.query(
      "SELECT * FROM kyc_documents WHERE user_id=$1",
      [req.user.id]
    );

    res.json({
      success: true,
      kyc_status: userRes.rows[0]?.kyc_status,
      document: docRes.rows[0] || null,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PENDING LIST (for auditor/admin/government dashboards)
router.get("/pending", protect, authorize("admin", "auditor", "government"), async (req, res) => {
  try {
    const pool = getPool();
    const result = await pool.query(
      `SELECT
         u.id, u.wallet_address, u.name, u.email, u.role, u.kyc_status,
         d.business_name, d.gst_number, d.aadhaar_number, d.pan_number,
         d.business_type, d.annual_turnover, d.doc_hash, d.submitted_at, d.verified_at
       FROM users u
       JOIN kyc_documents d ON d.user_id = u.id
       WHERE u.kyc_status = 'pending'
       ORDER BY d.submitted_at DESC NULLS LAST`
    );
    res.json({ success: true, pending: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// VERIFY
router.post("/verify/:userId", protect, authorize("admin", "auditor", "government"), async (req, res) => {
  try {
    const { status } = req.body;
    const { userId } = req.params;

    if (!["verified", "rejected", "pending"].includes(String(status || ""))) {
      return res.status(400).json({ success: false, message: "Invalid status" });
    }

    const pool = getPool();

    await pool.query(
      "UPDATE users SET kyc_status=$1 WHERE id=$2",
      [status, userId]
    );

    await pool.query(
      "UPDATE kyc_documents SET verified_at=CURRENT_TIMESTAMP WHERE user_id=$1",
      [userId]
    );

    let txHash = null;
    try {
      const tx = await verifyKYCOnChain(req.user.wallet_address, status === "verified");
      txHash = tx?.hash;
    } catch {}

    try {
      await pool.query(
        `INSERT INTO audit_logs (actor_wallet, action, details, tx_hash)
         VALUES ($1,$2,$3,$4)`,
        [
          req.user.wallet_address,
          status === "verified" ? "KYC_VERIFIED" : "KYC_REJECTED",
          JSON.stringify({ userId, status }),
          txHash,
        ]
      );
    } catch {}

    res.json({ success: true, txHash });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;