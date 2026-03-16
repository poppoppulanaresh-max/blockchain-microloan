// backend/routes/admin.js
const router = require("express").Router();
const { getPool }            = require("../config/db");
const { protect, authorize } = require("../middleware/auth");

// ── GET /api/admin/dashboard ──────────────────────────
router.get("/dashboard", protect, authorize("admin", "auditor", "government"), async (req, res) => {
  try {
    const pool = getPool();
    const [[stats]] = await pool.execute(`
      SELECT
        COUNT(*) AS total_loans,
        SUM(CASE WHEN status='PENDING'   THEN 1 ELSE 0 END) AS pending,
        SUM(CASE WHEN status='APPROVED'  THEN 1 ELSE 0 END) AS approved,
        SUM(CASE WHEN status='ACTIVE'    THEN 1 ELSE 0 END) AS active,
        SUM(CASE WHEN status='COMPLETED' THEN 1 ELSE 0 END) AS completed,
        SUM(CASE WHEN status='REJECTED'  THEN 1 ELSE 0 END) AS rejected,
        SUM(CASE WHEN status='DEFAULTED' THEN 1 ELSE 0 END) AS defaulted
      FROM loans
    `);
    const [[users]] = await pool.execute(`
      SELECT COUNT(*) AS total,
        SUM(CASE WHEN role='borrower' THEN 1 ELSE 0 END) AS borrowers,
        SUM(CASE WHEN role='lender'   THEN 1 ELSE 0 END) AS lenders,
        SUM(CASE WHEN kyc_status='pending' THEN 1 ELSE 0 END) AS pending_kyc
      FROM users
    `);
    const [recentLogs] = await pool.execute(`
      SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 20
    `);
    res.json({ success: true, stats, users, recentLogs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/admin/audit-logs ─────────────────────────
router.get("/audit-logs", protect, authorize("admin","auditor","government"), async (req, res) => {
  try {
    const pool = getPool();
    const [logs] = await pool.execute(`
      SELECT al.*, l.loan_id_hash, u.name AS actor_name
      FROM audit_logs al
      LEFT JOIN loans l ON l.id = al.loan_id
      LEFT JOIN users u ON u.wallet_address = al.actor_wallet
      ORDER BY al.created_at DESC
      LIMIT 200
    `);
    res.json({ success: true, logs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
