import { Router } from "express";
import { getPool } from "../config/db.js";
import { protect } from "../middleware/auth.js";

const router = Router();

router.get("/:loanId", protect, async (req, res) => {
  try {
    const pool = getPool();

    const result = await pool.query(
      "SELECT * FROM repayments WHERE loan_id=$1",
      [req.params.loanId]
    );

    res.json({ success: true, repayments: result.rows });
  } catch {
    res.status(500).json({ success: false });
  }
});

export default router;