import { Router } from "express";
import crypto from "crypto";
import { getPool } from "../config/db.js";
import { protect, authorize } from "../middleware/auth.js";

const router = Router();

router.post("/:loanId/submit", protect, authorize("borrower"), async (req, res) => {
  try {
    const { stage, billDescription } = req.body;
    const pool = getPool();

    const proofHash = crypto.createHash("sha256").update(billDescription).digest("hex");

    await pool.query(
      "UPDATE milestones SET status='SUBMITTED', proof_hash=$1 WHERE loan_id=$2 AND stage=$3",
      [proofHash, req.params.loanId, stage]
    );

    res.json({ success: true });
  } catch {
    res.status(500).json({ success: false });
  }
});

router.get("/:loanId", async (req, res) => {
  try {
    const pool = getPool();

    const result = await pool.query(
      "SELECT * FROM milestones WHERE loan_id=$1",
      [req.params.loanId]
    );

    res.json({ success: true, milestones: result.rows });
  } catch {
    res.status(500).json({ success: false });
  }
});

export default router;
