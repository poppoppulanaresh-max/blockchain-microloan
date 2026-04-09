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
        SUM(CASE WHEN status='PENDING' THEN 1 ELSE 0 END) AS pending
      FROM loans
    `);

    const usersRes = await pool.query(`
      SELECT COUNT(*) AS total FROM users
    `);

    const logsRes = await pool.query(
      "SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 20"
    );

    res.json({
      success: true,
      stats: statsRes.rows[0],
      users: usersRes.rows[0],
      logs: logsRes.rows,
    });
  } catch {
    res.status(500).json({ success: false });
  }
});

export default router;