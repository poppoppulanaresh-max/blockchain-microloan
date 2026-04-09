import { Router } from "express";
import crypto from "crypto";
import { getPool } from "../config/db.js";
import { protect, authorize } from "../middleware/auth.js";

const router = Router();

router.post("/:loanId/submit", protect, authorize("borrower"), async (req, res) => {
  try {
    const { stage, billDescription, proofHash } = req.body;
    const pool = getPool();

    const computed =
      typeof proofHash === "string" && /^[0-9a-fA-F]{64}$/.test(proofHash)
        ? proofHash.toLowerCase()
        : crypto.createHash("sha256").update(String(billDescription || "")).digest("hex");

    await pool.query(
      "UPDATE milestones SET status='SUBMITTED', proof_hash=$1, bill_description=$2 WHERE loan_id=$3 AND stage=$4",
      [computed, billDescription, req.params.loanId, stage]
    );

    try {
      await pool.query(
        `INSERT INTO audit_logs (loan_id, actor_wallet, action, details)
         VALUES ($1,$2,'MILESTONE_SUBMITTED',$3)`,
        [req.params.loanId, req.user.wallet_address, JSON.stringify({ stage })]
      );
    } catch {}

    res.json({ success: true });
  } catch {
    res.status(500).json({ success: false });
  }
});

// LENDER verifies milestone and releases funds (best-effort DB sync)
router.post("/:loanId/verify", protect, authorize("lender"), async (req, res) => {
  try {
    const { stage } = req.body;
    if (!stage) return res.status(400).json({ success: false, message: "stage required" });
    const pool = getPool();

    // ensure lender owns this loan
    const loanRes = await pool.query("SELECT lender_id, loan_id_hash FROM loans WHERE id=$1", [req.params.loanId]);
    const loan = loanRes.rows[0];
    if (!loan) return res.status(404).json({ success: false, message: "Loan not found" });
    if (loan.lender_id !== req.user.id) return res.status(403).json({ success: false, message: "Not your loan" });

    const txHash = req.body?.txHash || null;

    await pool.query(
      "UPDATE milestones SET status='RELEASED', tx_hash=$1, released_at=CURRENT_TIMESTAMP WHERE loan_id=$2 AND stage=$3",
      [txHash, req.params.loanId, stage]
    );

    try {
      await pool.query(
        `INSERT INTO audit_logs (loan_id, actor_wallet, action, details, tx_hash)
         VALUES ($1,$2,'MILESTONE_RELEASED',$3,$4)`,
        [req.params.loanId, req.user.wallet_address, JSON.stringify({ stage }), txHash]
      );
    } catch {}

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
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
