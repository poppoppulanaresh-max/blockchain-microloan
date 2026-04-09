import { Router } from "express";
import { getPool } from "../config/db.js";
import { protect } from "../middleware/auth.js";

const router = Router();

router.post("/:loanId/record", protect, async (req, res) => {
  try {
    const { installmentNo, txHash, amountPaidWei } = req.body || {};
    if (!installmentNo || !txHash) {
      return res.status(400).json({ success: false, message: "installmentNo and txHash required" });
    }

    const pool = getPool();

    // Load loan and authorize borrower/lender/admin-ish
    const loanRes = await pool.query("SELECT borrower_id, lender_id FROM loans WHERE id=$1", [req.params.loanId]);
    const loan = loanRes.rows[0];
    if (!loan) return res.status(404).json({ success: false, message: "Loan not found" });

    const allowed =
      loan.borrower_id === req.user.id ||
      (loan.lender_id && loan.lender_id === req.user.id) ||
      ["admin", "auditor", "government"].includes(req.user.role);
    if (!allowed) return res.status(403).json({ success: false, message: "Not authorized" });

    // Mark installment paid (prefer updating the schedule row)
    const upd = await pool.query(
      `UPDATE repayments
       SET paid=true, tx_hash=$1, amount_wei=$2, paid_at=CURRENT_TIMESTAMP
       WHERE loan_id=$3 AND installment_no=$4
       RETURNING id`,
      [txHash, amountPaidWei || null, req.params.loanId, installmentNo]
    );

    // If no schedule row exists (older DB), insert a record anyway
    if (!upd.rows.length) {
      await pool.query(
        `INSERT INTO repayments (loan_id, installment_no, paid, tx_hash, amount_wei, paid_at)
         VALUES ($1,$2,true,$3,$4,CURRENT_TIMESTAMP)`,
        [req.params.loanId, installmentNo, txHash, amountPaidWei || null]
      );
    }

    try {
      await pool.query(
        `INSERT INTO audit_logs (loan_id, actor_wallet, action, details, tx_hash)
         VALUES ($1,$2,'REPAYMENT_MADE',$3,$4)`,
        [req.params.loanId, req.user.wallet_address, JSON.stringify({ installmentNo, amountPaidWei: amountPaidWei || null }), txHash]
      );
    } catch {}

    // If all repayments are paid, mark loan completed
    try {
      const remainRes = await pool.query(
        `SELECT COUNT(*)::int AS remaining
         FROM repayments
         WHERE loan_id=$1 AND (paid IS DISTINCT FROM true)`,
        [req.params.loanId]
      );
      if ((remainRes.rows[0]?.remaining || 0) === 0) {
        await pool.query("UPDATE loans SET status='COMPLETED' WHERE id=$1 AND status='ACTIVE'", [req.params.loanId]);
      }
    } catch {}

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

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