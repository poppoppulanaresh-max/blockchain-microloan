import { Router } from "express";
import { Web3 } from "web3";
import { protect, authorize } from "../middleware/auth.js";
import { getPool } from "../config/db.js";
import { setCreditScoreOnChain } from "../config/blockchain.js";

const router = Router();

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

async function calculateCreditScore(borrowerId, loanAmount, pool) {
  const kycResult = await pool.query(
    "SELECT annual_turnover FROM kyc_documents WHERE user_id=$1",
    [borrowerId]
  );
  const kyc = kycResult.rows;

  const historyResult = await pool.query(
    `SELECT COUNT(*) AS total,
            SUM(CASE WHEN status='COMPLETED' THEN 1 ELSE 0 END) AS completed,
            SUM(CASE WHEN status='DEFAULTED' THEN 1 ELSE 0 END) AS defaulted
     FROM loans WHERE borrower_id=$1`,
    [borrowerId]
  );
  const history = historyResult.rows;

  let score = 600;

  const turnover = parseFloat(kyc[0]?.annual_turnover || 0);
  const amount = parseFloat(loanAmount) / 1e18;

  if (turnover > 5000000) score += 100;
  else if (turnover > 1000000) score += 50;
  else if (turnover < 100000) score -= 100;

  const { total, completed, defaulted } = history[0];
  if (total > 0) {
    const repayRate = completed / total;
    score += Math.round(repayRate * 150);
    score -= defaulted * 100;
  }

  if (turnover > 0) {
    const ratio = amount / (turnover / 1e18);
    if (ratio > 0.5) score -= 80;
    else if (ratio < 0.1) score += 30;
  }

  return Math.min(850, Math.max(300, score));
}

// POST /apply
router.post("/apply", protect, authorize("borrower"), async (req, res) => {
  try {
    const { amountWei, interestRate, tenureMonths, durationDays, collateral, purpose } = req.body;
    const tenure = tenureMonths || Math.round((durationDays || 0) / 30) || 12;

    if (!amountWei || !interestRate) {
      return res.status(400).json({ success: false, message: "amountWei and interestRate required" });
    }

    const pool = getPool();

    const userResult = await pool.query(
      "SELECT kyc_status, wallet_address FROM users WHERE id=$1",
      [req.user.id]
    );
    const userRows = userResult.rows;

    if (!userRows.length || userRows[0].kyc_status !== "verified") {
      return res.status(403).json({ success: false, message: "KYC not verified" });
    }

    const creditScore = await calculateCreditScore(req.user.id, amountWei, pool);

    const web3 = new Web3();
    const loanIdHash = web3.utils.soliditySha3(
      { type: "address", value: userRows[0].wallet_address },
      { type: "uint256", value: String(Date.now()) },
      { type: "uint256", value: String(amountWei) }
    );

    const initialStatus = creditScore < 500 ? "REJECTED" : "PENDING";

    const result = await pool.query(
      `INSERT INTO loans
       (loan_id_hash, borrower_id, amount_wei, interest_rate,
        tenure_months, collateral, purpose, credit_score, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING id`,
      [loanIdHash, req.user.id, amountWei, interestRate, tenure, collateral || null, purpose || null, creditScore, initialStatus]
    );

    const loanDbId = result.rows[0].id;

    try {
      const tx = await setCreditScoreOnChain(loanIdHash, creditScore);
      await pool.query(
        "UPDATE loans SET tx_hash_credit=$1 WHERE id=$2",
        [tx.hash, loanDbId]
      );
    } catch {}

    if (initialStatus !== "REJECTED") {
      const milestones = [
        { stage: 1, pct: 20 },
        { stage: 2, pct: 30 },
        { stage: 3, pct: 30 },
        { stage: 4, pct: 20 },
      ];

      for (const m of milestones) {
        await pool.query(
          "INSERT INTO milestones (loan_id, stage, pct, status) VALUES ($1,$2,$3,'PENDING')",
          [loanDbId, m.stage, m.pct]
        );
      }
    }

    await pool.query(
      `INSERT INTO audit_logs (loan_id, actor_wallet, action, details)
       VALUES ($1,$2,'LOAN_APPLIED',$3)`,
      [loanDbId, req.user.wallet_address, JSON.stringify({ amountWei, creditScore })]
    );

    res.json({
      success: true,
      loanId: loanDbId,
      loanIdHash,
      creditScore,
      status: initialStatus,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /my
router.get("/my", protect, async (req, res) => {
  try {
    const pool = getPool();

    const result = await pool.query(
      "SELECT * FROM loans WHERE borrower_id=$1 ORDER BY applied_at DESC",
      [req.user.id]
    );

    res.json({ success: true, loans: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// APPROVE
router.post("/:id/approve", protect, authorize("lender"), async (req, res) => {
  try {
    const pool = getPool();

    await pool.query(
      "UPDATE loans SET status='APPROVED', lender_id=$1, approved_at=CURRENT_TIMESTAMP WHERE id=$2",
      [req.user.id, req.params.id]
    );

    res.json({ success: true, message: "Approved" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// REJECT
router.post("/:id/reject", protect, authorize("lender"), async (req, res) => {
  try {
    const pool = getPool();

    await pool.query(
      "UPDATE loans SET status='REJECTED' WHERE id=$1",
      [req.params.id]
    );

    res.json({ success: true, message: "Rejected" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;