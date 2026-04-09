import { Router } from "express";
import { getPool } from "../config/db.js";
import { protect, authorize } from "../middleware/auth.js";

const router = Router();

router.get("/dashboard", protect, authorize("admin", "auditor", "government"), async (req, res) => {
  try {
    const pool = getPool();

    const statsRes = await pool.query(`
      SELECT
        COUNT(*) AS total_loans,
        SUM(CASE WHEN status='PENDING' THEN 1 ELSE 0 END) AS pending,
        SUM(CASE WHEN status='APPROVED' THEN 1 ELSE 0 END) AS approved,
        SUM(CASE WHEN status='ACTIVE' THEN 1 ELSE 0 END) AS active,
        SUM(CASE WHEN status='COMPLETED' THEN 1 ELSE 0 END) AS completed,
        SUM(CASE WHEN status='REJECTED' THEN 1 ELSE 0 END) AS rejected,
        SUM(CASE WHEN status='DEFAULTED' THEN 1 ELSE 0 END) AS defaulted
      FROM loans
    `);

    const usersRes = await pool.query(`
      SELECT COUNT(*) AS total FROM users
    `);

    const logsRes = await pool.query(
      `SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 50`
    );

    const recentLoansRes = await pool.query(
      `SELECT
         l.*,
         bu.name AS borrower_name,
         lu.name AS lender_name,
         k.business_name
       FROM loans l
       LEFT JOIN users bu ON bu.id = l.borrower_id
       LEFT JOIN users lu ON lu.id = l.lender_id
       LEFT JOIN kyc_documents k ON k.user_id = l.borrower_id
       ORDER BY l.applied_at DESC
       LIMIT 50`
    );

    res.json({
      success: true,
      stats: statsRes.rows[0],
      users: usersRes.rows[0],
      logs: logsRes.rows,
      recentLoans: recentLoansRes.rows,
    });
  } catch {
    res.status(500).json({ success: false });
  }
});

router.get("/audit-logs", protect, authorize("admin", "auditor", "government"), async (req, res) => {
  try {
    const pool = getPool();
    const result = await pool.query(
      `SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 500`
    );
    res.json({ success: true, logs: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;