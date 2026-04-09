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

function computeEmiWei(principalWeiStr, annualRatePct, tenureMonths) {
  const P = Number(principalWeiStr || 0);
  const r = (Number(annualRatePct || 0) / 100) / 12;
  const n = Math.max(1, Number(tenureMonths || 1));
  if (!isFinite(P) || !isFinite(r) || !isFinite(n) || P <= 0) return "0";
  if (r === 0) return String(Math.round(P / n));
  const emi = (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  return String(Math.max(0, Math.round(emi)));
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

    const loansRes = await pool.query(
      "SELECT * FROM loans WHERE borrower_id=$1 ORDER BY applied_at DESC",
      [req.user.id]
    );

    const loanIds = loansRes.rows.map((r) => r.id);

    let milestonesByLoan = {};
    let repaymentsByLoan = {};

    if (loanIds.length) {
      const mRes = await pool.query(
        `SELECT * FROM milestones WHERE loan_id = ANY($1::int[]) ORDER BY loan_id, stage`,
        [loanIds]
      );
      milestonesByLoan = mRes.rows.reduce((acc, m) => {
        (acc[m.loan_id] ||= []).push(m);
        return acc;
      }, {});

      const rRes = await pool.query(
        `SELECT * FROM repayments WHERE loan_id = ANY($1::int[]) ORDER BY loan_id, installment_no NULLS LAST, due_date NULLS LAST, id`,
        [loanIds]
      );
      repaymentsByLoan = rRes.rows.reduce((acc, r) => {
        (acc[r.loan_id] ||= []).push(r);
        return acc;
      }, {});
    }

    const loans = loansRes.rows.map((l) => ({
      ...l,
      milestones: milestonesByLoan[l.id] || [],
      repayments: repaymentsByLoan[l.id] || [],
    }));

    res.json({ success: true, loans });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /pending (for lenders)
router.get("/pending", protect, authorize("lender"), async (req, res) => {
  try {
    const pool = getPool();
    const result = await pool.query(
      `SELECT
         l.*,
         u.name AS borrower_name,
         u.wallet_address,
         k.business_name,
         k.gst_number,
         k.business_type,
         k.annual_turnover
       FROM loans l
       JOIN users u ON u.id = l.borrower_id
       LEFT JOIN kyc_documents k ON k.user_id = l.borrower_id
       WHERE l.status = 'PENDING'
       ORDER BY l.applied_at DESC`
    );
    res.json({ success: true, loans: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /my-approved (for lenders)
router.get("/my-approved", protect, authorize("lender"), async (req, res) => {
  try {
    const pool = getPool();
    const loansRes = await pool.query(
      `SELECT
         l.*,
         u.name AS borrower_name,
         k.business_name
       FROM loans l
       JOIN users u ON u.id = l.borrower_id
       LEFT JOIN kyc_documents k ON k.user_id = l.borrower_id
       WHERE l.lender_id = $1
       ORDER BY l.approved_at DESC NULLS LAST, l.applied_at DESC`,
      [req.user.id]
    );

    const loanIds = loansRes.rows.map((r) => r.id);
    let milestonesByLoan = {};
    if (loanIds.length) {
      const mRes = await pool.query(
        `SELECT * FROM milestones WHERE loan_id = ANY($1::int[]) ORDER BY loan_id, stage`,
        [loanIds]
      );
      milestonesByLoan = mRes.rows.reduce((acc, m) => {
        (acc[m.loan_id] ||= []).push(m);
        return acc;
      }, {});
    }

    const loans = loansRes.rows.map((l) => ({ ...l, milestones: milestonesByLoan[l.id] || [] }));
    res.json({ success: true, loans });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /:id (loan detail page)
router.get("/:id", protect, async (req, res) => {
  try {
    const pool = getPool();
    const loanRes = await pool.query(
      `SELECT
         l.*,
         bu.name AS borrower_name,
         lu.name AS lender_name
       FROM loans l
       LEFT JOIN users bu ON bu.id = l.borrower_id
       LEFT JOIN users lu ON lu.id = l.lender_id
       WHERE l.id = $1`,
      [req.params.id]
    );
    const loan = loanRes.rows[0];
    if (!loan) return res.status(404).json({ success: false, message: "Loan not found" });

    // Access rules: borrower, lender assigned, or admin/auditor/government
    const allowed =
      loan.borrower_id === req.user.id ||
      (loan.lender_id && loan.lender_id === req.user.id) ||
      ["admin", "auditor", "government"].includes(req.user.role);
    if (!allowed) return res.status(403).json({ success: false, message: "Not authorized" });

    const milestonesRes = await pool.query(
      "SELECT * FROM milestones WHERE loan_id=$1 ORDER BY stage",
      [req.params.id]
    );
    const repaymentsRes = await pool.query(
      "SELECT * FROM repayments WHERE loan_id=$1 ORDER BY installment_no NULLS LAST, due_date NULLS LAST, id",
      [req.params.id]
    );

    res.json({
      success: true,
      loan: {
        ...loan,
        milestones: milestonesRes.rows,
        repayments: repaymentsRes.rows,
      },
    });
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

// FUNDED (lender deposited funds on-chain; mark ACTIVE + generate repayment schedule)
router.post("/:id/funded", protect, authorize("lender"), async (req, res) => {
  try {
    const pool = getPool();

    const loanRes = await pool.query("SELECT * FROM loans WHERE id=$1", [req.params.id]);
    const loan = loanRes.rows[0];
    if (!loan) return res.status(404).json({ success: false, message: "Loan not found" });
    if (loan.lender_id !== req.user.id) {
      return res.status(403).json({ success: false, message: "Not your loan" });
    }

    // Mark ACTIVE
    await pool.query(
      "UPDATE loans SET status='ACTIVE', funded_at=CURRENT_TIMESTAMP WHERE id=$1",
      [req.params.id]
    );

    // Auto-release milestone stage 1 (so borrower immediately sees some funds released by default)
    try {
      await pool.query(
        `UPDATE milestones
         SET status='RELEASED', tx_hash=$1, released_at=CURRENT_TIMESTAMP
         WHERE loan_id=$2 AND stage=1 AND status <> 'RELEASED'`,
        [req.body?.txHash || null, req.params.id]
      );
    } catch {}

    // Create repayment schedule if not existing
    const existingRepay = await pool.query("SELECT COUNT(*)::int AS c FROM repayments WHERE loan_id=$1", [req.params.id]);
    const count = existingRepay.rows[0]?.c || 0;
    if (count === 0) {
      const n = Math.max(1, Number(loan.tenure_months || 12));
      const emiWei = computeEmiWei(loan.amount_wei, loan.interest_rate, n);
      const start = new Date();
      for (let i = 1; i <= n; i++) {
        const due = addDays(start, 30 * i);
        await pool.query(
          `INSERT INTO repayments (loan_id, installment_no, due_date, emi_amount_wei, paid, amount_wei)
           VALUES ($1,$2,$3,$4,false,null)`,
          [req.params.id, i, due, emiWei]
        );
      }
    }

    try {
      await pool.query(
        `INSERT INTO audit_logs (loan_id, actor_wallet, action, details)
         VALUES ($1,$2,'LOAN_FUNDED',$3)`,
        [req.params.id, req.user.wallet_address, JSON.stringify({ txHash: req.body?.txHash || null })]
      );
    } catch {}

    res.json({ success: true, message: "Loan marked as ACTIVE" });
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