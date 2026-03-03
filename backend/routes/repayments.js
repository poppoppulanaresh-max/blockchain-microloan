// backend/routes/repayments.js
const router = require("express").Router();
const { getPool }            = require("../config/db");
const { protect, authorize } = require("../middleware/auth");
const { markDefaultedOnChain } = require("../config/blockchain");

// ── GET /api/repayments/:loanId ───────────────────────
router.get("/:loanId", protect, async (req, res) => {
  try {
    const pool = getPool();
    const [repayments] = await pool.execute(
      "SELECT * FROM repayments WHERE loan_id=? ORDER BY installment_no",
      [req.params.loanId]
    );
    res.json({ success: true, repayments });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/repayments/:loanId/record ───────────────
// Records a repayment that was made via MetaMask on-chain
// Frontend calls this AFTER the blockchain transaction confirms
router.post("/:loanId/record", protect, authorize("borrower"), async (req, res) => {
  try {
    const { installmentNo, txHash, amountPaidWei } = req.body;
    const pool = getPool();

    const [loans] = await pool.execute(
      "SELECT * FROM loans WHERE id=? AND borrower_id=?",
      [req.params.loanId, req.user.id]
    );
    if (!loans.length) return res.status(404).json({ success: false, message: "Loan not found" });

    // Update repayment record
    await pool.execute(`
      UPDATE repayments
      SET paid=TRUE, paid_at=NOW(), tx_hash=?
      WHERE loan_id=? AND installment_no=?
    `, [txHash, req.params.loanId, installmentNo]);

    // Check if all repayments are done → COMPLETED
    const [pending] = await pool.execute(
      "SELECT COUNT(*) as c FROM repayments WHERE loan_id=? AND paid=FALSE",
      [req.params.loanId]
    );
    if (Number(pending[0].c) === 0) {
      await pool.execute(
        "UPDATE loans SET status='COMPLETED', completed_at=NOW() WHERE id=?",
        [req.params.loanId]
      );
    }

    await pool.execute(`
      INSERT INTO audit_logs (loan_id, actor_wallet, action, details, tx_hash)
      VALUES (?,?,'REPAYMENT_MADE',?,?)
    `, [req.params.loanId, req.user.wallet_address,
        JSON.stringify({ installmentNo, amountPaidWei }), txHash]);

    res.json({ success: true, message: "Repayment recorded" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/repayments/:loanId/default ──────────────
// Admin marks a loan as defaulted
router.post("/:loanId/default", protect, authorize("admin"), async (req, res) => {
  try {
    const pool = getPool();
    const [loans] = await pool.execute(
      "SELECT * FROM loans WHERE id=?", [req.params.loanId]
    );
    if (!loans.length) return res.status(404).json({ success: false, message: "Loan not found" });

    const tx = await markDefaultedOnChain(loans[0].loan_id_hash);

    await pool.execute(
      "UPDATE loans SET status='DEFAULTED' WHERE id=?", [req.params.loanId]
    );
    await pool.execute(`
      INSERT INTO audit_logs (loan_id, actor_wallet, action, details, tx_hash)
      VALUES (?,?,'LOAN_DEFAULTED',?,?)
    `, [req.params.loanId, req.user.wallet_address, JSON.stringify({}), tx.transactionHash]);

    res.json({ success: true, message: "Loan marked as defaulted", txHash: tx.transactionHash });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
