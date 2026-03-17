const express = require("express");
const router = express.Router();
const { protect, authorize } = require("../middleware/auth");
const { getPool } = require("../config/db");
const { setCreditScoreOnChain, getLoanStatusFromChain } = require("../config/blockchain");

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

// ── Credit Score Engine ───────────────────────────────────
async function calculateCreditScore(borrowerId, loanAmount, pool) {
  const [kyc] = await pool.execute(
    "SELECT annual_turnover FROM kyc_documents WHERE user_id=?",
    [borrowerId]
  );
  const [history] = await pool.execute(
    `SELECT
       COUNT(*) AS total,
       SUM(status='COMPLETED') AS completed,
       SUM(status='DEFAULTED')  AS defaulted
     FROM loans WHERE borrower_id=?`,
    [borrowerId]
  );

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

// ── POST /api/loans/apply ─────────────────────────────────
router.post("/apply", protect, authorize("borrower"), async (req, res) => {
  try {
    // Accept tenureMonths (frontend) or durationDays (legacy)
    const { amountWei, interestRate, tenureMonths, durationDays, collateral, purpose } = req.body;
    const tenure = tenureMonths || Math.round((durationDays || 0) / 30) || 12;

    if (!amountWei || !interestRate) {
      return res.status(400).json({ success: false, message: "amountWei and interestRate are required" });
    }

    const pool = getPool();

    // Borrower must have verified KYC before applying
    const [userRows] = await pool.execute(
      "SELECT kyc_status, wallet_address FROM users WHERE id=?",
      [req.user.id]
    );
    if (!userRows.length || userRows[0].kyc_status !== "verified") {
      return res.status(403).json({ success: false, message: "KYC must be verified before applying for a loan" });
    }

    const creditScore = await calculateCreditScore(req.user.id, amountWei, pool);

    // NOTE: On-chain contract enforces MIN_SCORE=500 for approval.
    // If backend allows lower scores, lenders will hit a revert when approving on-chain.
    const MIN_CREDIT_SCORE = Number(process.env.MIN_CREDIT_SCORE || 500);
    const CHAIN_MIN_SCORE = 500;
    const EFFECTIVE_MIN_SCORE = Math.max(MIN_CREDIT_SCORE, CHAIN_MIN_SCORE);

    const { Web3 } = require("web3");
    const web3 = new Web3();
    // Use typed args so soliditySha3 never produces a bare hex — always 0x-prefixed
    const loanIdHash = web3.utils.soliditySha3(
      { type: "address", value: userRows[0].wallet_address },
      { type: "uint256", value: String(Date.now()) },
      { type: "uint256", value: String(amountWei) }
    );

    const initialStatus = creditScore < EFFECTIVE_MIN_SCORE ? "REJECTED" : "PENDING";
    const rejectReason =
      creditScore < EFFECTIVE_MIN_SCORE
        ? `Credit score below minimum threshold (${EFFECTIVE_MIN_SCORE})`
        : null;

    const [result] = await pool.execute(
      `INSERT INTO loans
         (loan_id_hash, borrower_id, amount_wei, interest_rate,
          tenure_months, collateral, purpose, credit_score, status, reject_reason)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [loanIdHash, req.user.id, amountWei, interestRate,
       tenure, collateral || null, purpose || null, creditScore, initialStatus, rejectReason]
    );

    const loanDbId = result.insertId;

    try {
      const tx = await setCreditScoreOnChain(loanIdHash, creditScore);
      await pool.execute(
        "UPDATE loans SET tx_hash_credit=? WHERE id=?",
        [tx.hash, loanDbId]
      );
    } catch (chainErr) {
      console.warn("Blockchain sync failed (non-fatal):", chainErr.message);
    }

    if (initialStatus !== "REJECTED") {
      // 4 milestones matching frontend weights: 20% / 30% / 30% / 20%
      const milestones = [
        { stage: 1, pct: 20 },
        { stage: 2, pct: 30 },
        { stage: 3, pct: 30 },
        { stage: 4, pct: 20 },
      ];
      for (const m of milestones) {
        await pool.execute(
          "INSERT INTO milestones (loan_id, stage, pct, status) VALUES (?,?,?,'PENDING')",
          [loanDbId, m.stage, m.pct]
        );
      }
    }

    await pool.execute(
      `INSERT INTO audit_logs (loan_id, actor_wallet, action, details)
       VALUES (?, ?, 'LOAN_APPLIED', ?)`,
      [loanDbId, req.user.wallet_address,
       JSON.stringify({ amountWei, creditScore, status: initialStatus })]
    );

    res.json({
      success: true,
      loanId: loanDbId,
      loanIdHash,
      creditScore,
      status: initialStatus,
      rejectReason,
    });
  } catch (err) {
    console.error("Loan apply error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/loans/my ─────────────────────────────────────
router.get("/my", protect, async (req, res) => {
  try {
    const pool = getPool();
    const [loans] = await pool.execute(
      `SELECT l.*,
              COALESCE(l.tenure_months, 0) AS tenure_months,
              m.stage, m.pct, m.status AS milestone_status, m.tx_hash AS milestone_tx
       FROM loans l
       LEFT JOIN milestones m ON m.loan_id = l.id
       WHERE l.borrower_id = ?
       ORDER BY l.applied_at DESC, m.stage ASC`,
      [req.user.id]
    );

    // Group milestones into each loan
    const loanMap = {};
    for (const row of loans) {
      if (!loanMap[row.id]) {
        const { stage, pct, milestone_status, milestone_tx, ...loanData } = row;
        loanMap[row.id] = { ...loanData, milestones: [] };
      }
      if (row.stage) {
        loanMap[row.id].milestones.push({
          stage: row.stage,
          pct: row.pct,
          status: row.milestone_status,
          tx_hash: row.milestone_tx,
        });
      }
    }

    res.json({ success: true, loans: Object.values(loanMap) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/loans/pending ────────────────────────────────
// FIX 1 (from commit): Added "auditor" + "government" to authorize()
// FIX 2 (from commit): KYC join now includes pan, aadhaar, business_type
// FIX (from commit):   JOIN → LEFT JOIN so loans without KYC still show
router.get("/pending", protect, authorize("lender", "auditor", "government", "admin"), async (req, res) => {
  try {
    const pool = getPool();
    const [loans] = await pool.execute(
      `SELECT
         l.*,
         u.name             AS borrower_name,
         u.email            AS borrower_email,
         u.wallet_address   AS borrower_wallet,
         k.business_name,
         k.annual_turnover,
         k.gst_number,
         k.pan_number,
         k.aadhaar_number,
         k.business_type
       FROM loans l
       JOIN  users u ON u.id = l.borrower_id
       LEFT JOIN kyc_documents k ON k.user_id = l.borrower_id
       WHERE l.status = 'PENDING'
       ORDER BY l.applied_at DESC`
    );
    res.json({ success: true, loans });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/loans/my-approved ────────────────────────────
// FIX 3 (from commit): This route was missing — lender "My Investments" was always empty
// FIX 4 (new):         Replaced N+1 milestone loop with a single JOIN query
router.get("/my-approved", protect, authorize("lender"), async (req, res) => {
  try {
    const pool = getPool();

    // Single query: loans + milestones joined — no N+1
    const [rows] = await pool.execute(
      `SELECT
         l.*,
         u.name             AS borrower_name,
         u.email            AS borrower_email,
         u.wallet_address   AS borrower_wallet,
         k.business_name,
         k.annual_turnover,
         k.gst_number,
         k.pan_number,
         k.aadhaar_number,
         k.business_type,
         m.stage            AS milestone_stage,
         m.pct              AS milestone_pct,
         m.status           AS milestone_status,
         m.tx_hash          AS milestone_tx
       FROM loans l
       JOIN  users u ON u.id = l.borrower_id
       LEFT JOIN kyc_documents k ON k.user_id = l.borrower_id
       LEFT JOIN milestones m ON m.loan_id = l.id
       WHERE l.lender_id = ?
         AND l.status IN ('APPROVED','ACTIVE','COMPLETED','DEFAULTED')
       ORDER BY l.approved_at DESC, m.stage ASC`,
      [req.user.id]
    );

    // Group milestones by loan
    const loanMap = {};
    for (const row of rows) {
      if (!loanMap[row.id]) {
        const { milestone_stage, milestone_pct, milestone_status, milestone_tx, ...loanData } = row;
        loanMap[row.id] = { ...loanData, milestones: [] };
      }
      if (row.milestone_stage) {
        loanMap[row.id].milestones.push({
          stage: row.milestone_stage,
          pct: row.milestone_pct,
          status: row.milestone_status,
          tx_hash: row.milestone_tx,
        });
      }
    }

    res.json({ success: true, loans: Object.values(loanMap) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/loans/all ────────────────────────────────────
router.get("/all", protect, authorize("admin", "government", "auditor"), async (req, res) => {
  try {
    const pool = getPool();
    const [loans] = await pool.execute(
      `SELECT l.*,
              u.name AS borrower_name, u.email AS borrower_email,
              u.wallet_address AS borrower_wallet,
              k.business_name, k.annual_turnover, k.gst_number
       FROM loans l
       JOIN  users u ON u.id = l.borrower_id
       LEFT JOIN kyc_documents k ON k.user_id = l.borrower_id
       ORDER BY l.applied_at DESC`
    );
    res.json({ success: true, loans });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/loans/:id ────────────────────────────────────
router.get("/:id", protect, async (req, res) => {
  try {
    const pool = getPool();
    const [loans] = await pool.execute(
      `SELECT l.*,
              u.name AS borrower_name, u.email AS borrower_email,
              u.wallet_address AS borrower_wallet
       FROM loans l
       JOIN users u ON u.id = l.borrower_id
       WHERE l.id=?`,
      [req.params.id]
    );
    if (!loans.length) {
      return res.status(404).json({ success: false, message: "Loan not found" });
    }

    const loan = loans[0];

    const [milestones] = await pool.execute(
      "SELECT * FROM milestones WHERE loan_id=? ORDER BY stage",
      [loan.id]
    );
    const [repayments] = await pool.execute(
      "SELECT * FROM repayments WHERE loan_id=? ORDER BY installment_no",
      [loan.id]
    );

    res.json({ success: true, loan: { ...loan, milestones, repayments } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/loans/:id/approve ───────────────────────────
router.post("/:id/approve", protect, authorize("lender"), async (req, res) => {
  try {
    const pool = getPool();
    const [loans] = await pool.execute(
      "SELECT * FROM loans WHERE id=?",
      [req.params.id]
    );
    if (!loans.length) {
      return res.status(404).json({ success: false, message: "Loan not found" });
    }
    if (loans[0].status !== "PENDING") {
      return res.status(400).json({ success: false, message: "Loan is not pending" });
    }

    const { txHash } = req.body;

    await pool.execute(
      "UPDATE loans SET status='APPROVED', lender_id=?, approved_at=NOW(), tx_hash_approved=? WHERE id=?",
      [req.user.id, txHash || null, req.params.id]
    );

    await pool.execute(
      `INSERT INTO audit_logs (loan_id, actor_wallet, action, details, tx_hash)
       VALUES (?, ?, 'LOAN_APPROVED', ?, ?)`,
      [req.params.id, req.user.wallet_address,
       JSON.stringify({ loanId: req.params.id }), txHash || null]
    );

    res.json({ success: true, message: "Loan approved successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/loans/:id/reject ────────────────────────────
router.post("/:id/reject", protect, authorize("lender", "admin"), async (req, res) => {
  try {
    const { reason, txHash } = req.body;
    const pool = getPool();

    await pool.execute(
      "UPDATE loans SET status='REJECTED', reject_reason=?, tx_hash_approved=? WHERE id=?",
      [reason || "Rejected by lender", txHash || null, req.params.id]
    );

    await pool.execute(
      `INSERT INTO audit_logs (loan_id, actor_wallet, action, details, tx_hash)
       VALUES (?, ?, 'LOAN_REJECTED', ?, ?)`,
      [req.params.id, req.user.wallet_address,
       JSON.stringify({ reason }), txHash || null]
    );

    res.json({ success: true, message: "Loan rejected" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/loans/:id/funded ───────────────────────────
// Called after lender deposits funds on-chain.
// Syncs DB: sets loan ACTIVE, marks milestone-1 released, and creates repayment schedule.
router.post("/:id/funded", protect, authorize("lender"), async (req, res) => {
  try {
    const { txHash } = req.body;
    const pool = getPool();

    const [rows] = await pool.execute(
      "SELECT * FROM loans WHERE id=?",
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: "Loan not found" });

    const loan = rows[0];
    if (loan.lender_id !== req.user.id) {
      return res.status(403).json({ success: false, message: "Not your loan" });
    }
    if (!["APPROVED", "ACTIVE"].includes(loan.status)) {
      return res.status(400).json({ success: false, message: `Loan must be APPROVED to fund (current: ${loan.status})` });
    }

    // Mark loan ACTIVE
    await pool.execute(
      "UPDATE loans SET status='ACTIVE' WHERE id=?",
      [req.params.id]
    );

    // Ensure milestones exist (idempotent)
    const [ms] = await pool.execute("SELECT COUNT(*) AS c FROM milestones WHERE loan_id=?", [req.params.id]);
    if (Number(ms[0].c) === 0) {
      const milestones = [
        { stage: 1, pct: 20 },
        { stage: 2, pct: 30 },
        { stage: 3, pct: 30 },
        { stage: 4, pct: 20 },
      ];
      for (const m of milestones) {
        await pool.execute(
          "INSERT INTO milestones (loan_id, stage, pct, status) VALUES (?,?,?,'PENDING')",
          [req.params.id, m.stage, m.pct]
        );
      }
    }

    // Mark milestone-1 as released (contract auto-releases 20% on depositFunds)
    try {
      const amountWei = BigInt(loan.amount_wei);
      const released1 = ((amountWei * 20n) / 100n).toString();
      await pool.execute(
        `UPDATE milestones
         SET status='RELEASED', released_at=NOW(), amount_released=?, tx_hash=?
         WHERE loan_id=? AND stage=1`,
        [released1, txHash || null, req.params.id]
      );
    } catch (_) {
      // non-fatal
    }

    // Create repayment schedule if missing (idempotent)
    const [rep] = await pool.execute("SELECT COUNT(*) AS c FROM repayments WHERE loan_id=?", [req.params.id]);
    if (Number(rep[0].c) === 0) {
      const principal = BigInt(loan.amount_wei);
      const tenureMonths = Number(loan.tenure_months || 12);
      const interestRate = BigInt(loan.interest_rate || 1200); // annual rate * 100

      // Match solidity logic:
      // monthly = (principal * interestRate) / (100*100*12)
      // emi     = (principal / tenureMonths) + monthly
      const monthlyInterest = (principal * interestRate) / 1200000n;
      const base = principal / BigInt(tenureMonths);
      const emi = (base + monthlyInterest).toString();

      for (let i = 0; i < tenureMonths; i++) {
        const due = addDays(new Date(), (i + 1) * 30);
        await pool.execute(
          "INSERT INTO repayments (loan_id, installment_no, emi_amount_wei, due_date, paid) VALUES (?,?,?,?,FALSE)",
          [req.params.id, i, emi, due]
        );
      }
    }

    await pool.execute(
      `INSERT INTO audit_logs (loan_id, actor_wallet, action, details, tx_hash)
       VALUES (?, ?, 'FUNDS_DEPOSITED', ?, ?)`,
      [req.params.id, req.user.wallet_address, JSON.stringify({ loanId: req.params.id }), txHash || null]
    );

    res.json({ success: true, message: "Loan marked ACTIVE and repayments initialized" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;