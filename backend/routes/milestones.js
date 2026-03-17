// backend/routes/milestones.js
const router = require("express").Router();
const crypto = require("crypto");
const { getPool }            = require("../config/db");
const { protect, authorize } = require("../middleware/auth");
const { verifyAndReleaseMilestone } = require("../config/blockchain");

// ── POST /api/milestones/:loanId/submit ───────────────
// Borrower submits proof (bill hash) for milestone 2, 3, or 4
router.post("/:loanId/submit", protect, authorize("borrower"), async (req, res) => {
  try {
    const { stage, billDescription, proofData } = req.body;
    // stage must be 2, 3, or 4 (stage 1 is auto-released)
    if (![2, 3, 4].includes(Number(stage))) {
      return res.status(400).json({ success: false, message: "Stage must be 2, 3, or 4" });
    }

    const pool = getPool();
    const [loans] = await pool.execute(
      "SELECT * FROM loans WHERE id=? AND borrower_id=?",
      [req.params.loanId, req.user.id]
    );
    if (!loans.length) {
      return res.status(404).json({ success: false, message: "Loan not found" });
    }
    if (loans[0].status !== "ACTIVE") {
      return res.status(400).json({ success: false, message: "Loan must be ACTIVE" });
    }

    // Hash the proof document data
    const proofHash = "0x" + crypto.createHash("sha256")
      .update(proofData || billDescription).digest("hex");

    await pool.execute(`
      UPDATE milestones
      SET status='SUBMITTED', proof_hash=?, bill_description=?, submitted_at=NOW()
      WHERE loan_id=? AND stage=?
    `, [proofHash, billDescription, req.params.loanId, stage]);

    await pool.execute(`
      INSERT INTO audit_logs (loan_id, actor_wallet, action, details)
      VALUES (?,?,'MILESTONE_SUBMITTED',?)
    `, [req.params.loanId, req.user.wallet_address, JSON.stringify({ stage, proofHash })]);

    res.json({ success: true, message: `Stage ${stage} proof submitted`, proofHash });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/milestones/:loanId/verify ───────────────
// Admin or Lender verifies and releases milestone funds
router.post("/:loanId/verify", protect, authorize("admin","lender"), async (req, res) => {
  try {
    const { stage } = req.body;
    if (![2, 3, 4].includes(Number(stage))) {
      return res.status(400).json({ success: false, message: "Stage must be 2, 3, or 4" });
    }

    const pool = getPool();
    const [loans] = await pool.execute(
      "SELECT * FROM loans WHERE id=?", [req.params.loanId]
    );
    if (!loans.length) return res.status(404).json({ success: false, message: "Loan not found" });

    const [milestones] = await pool.execute(
      "SELECT * FROM milestones WHERE loan_id=? AND stage=?",
      [req.params.loanId, stage]
    );
    if (!milestones.length || milestones[0].status !== "SUBMITTED") {
      return res.status(400).json({ success: false, message: "Milestone not submitted" });
    }

    // Call blockchain to release funds
    const milestoneIndex = stage - 1; // 0-based for contract
    const tx = await verifyAndReleaseMilestone(loans[0].loan_id_hash, milestoneIndex);

    // Calculate release amount
    const amountWei  = BigInt(loans[0].amount_wei);
    const pct        = BigInt(milestones[0].pct ?? milestones[0].release_percent);
    const releaseAmt = ((amountWei * pct) / 100n).toString();

    await pool.execute(`
      UPDATE milestones
      SET status='RELEASED', released_at=NOW(), amount_released=?, tx_hash=?
      WHERE loan_id=? AND stage=?
    `, [releaseAmt, tx.transactionHash, req.params.loanId, stage]);

    // If stage 4 is released, loan becomes COMPLETED
    if (stage === 4) {
      // Check if all milestones released
      const [all] = await pool.execute(
        "SELECT COUNT(*) as c FROM milestones WHERE loan_id=? AND status!='RELEASED'",
        [req.params.loanId]
      );
      if (Number(all[0].c) === 0) {
        await pool.execute(
          "UPDATE loans SET status='ACTIVE' WHERE id=?", [req.params.loanId]
        );
      }
    }

    await pool.execute(`
      INSERT INTO audit_logs (loan_id, actor_wallet, action, details, tx_hash)
      VALUES (?,?,'MILESTONE_RELEASED',?,?)
    `, [req.params.loanId, req.user.wallet_address,
        JSON.stringify({ stage, releaseAmt }), tx.transactionHash]);

    res.json({
      success: true,
      message: `Stage ${stage} funds released`,
      txHash: tx.transactionHash,
      amountReleased: releaseAmt
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/milestones/:loanId ───────────────────────
router.get("/:loanId", protect, async (req, res) => {
  try {
    const pool = getPool();
    const [milestones] = await pool.execute(
      "SELECT * FROM milestones WHERE loan_id=? ORDER BY stage", [req.params.loanId]
    );
    res.json({ success: true, milestones });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;

// ═══════════════════════════════════════════════════════
// backend/routes/repayments.js
// ═══════════════════════════════════════════════════════
