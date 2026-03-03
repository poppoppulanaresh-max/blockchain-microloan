// backend/routes/loans.js
const router   = require("express").Router();
const { getPool }            = require("../config/db");
const { protect, authorize } = require("../middleware/auth");
const { setCreditScoreOnChain, getLoanStatusFromChain } = require("../config/blockchain");

// ── Credit Score Engine ────────────────────────────────
// Calculates a score 300-850 based on available data
async function calculateCreditScore(borrowerId, loanAmount, pool) {
  const [kyc]    = await pool.execute(
    "SELECT annual_turnover FROM kyc_documents WHERE user_id=?", [borrowerId]
  );
  const [history] = await pool.execute(`
    SELECT COUNT(*) as total,
           SUM(CASE WHEN status='COMPLETED' THEN 1 ELSE 0 END) as completed,
           SUM(CASE WHEN status='DEFAULTED' THEN 1 ELSE 0 END) as defaulted
    FROM loans WHERE borrower_id=?
  `, [borrowerId]);

  let score = 600; // Base score

  const turnover = parseFloat(kyc[0]?.annual_turnover || 0);
  const amount   = parseFloat(loanAmount) / 1e18; // Convert Wei to ETH

  // Turnover check
  if (turnover > 5000000)  score += 100;
  else if (turnover > 1000000) score += 50;
  else if (turnover < 100000)  score -= 100;

  // Repayment history
  const { total, completed, defaulted } = history[0];
  if (total > 0) {
    const repayRate = completed / total;
    score += Math.round(repayRate * 150);
    score -= defaulted * 100;
  }

  // Loan-to-turnover ratio
  if (turnover > 0) {
    const ratio = amount / (turnover / 1e18);
    if (ratio > 0.5) score -= 80;
    if (ratio > 1.0) score -= 120;
  }

  return Math.min(850, Math.max(300, score));
}

// ── POST /api/loans/apply ──────────────────────────────
router.post("/apply", protect, authorize("borrower"), async (req, res) => {
  try {
    const { amountWei, interestRate, tenureMonths, collateral } = req.body;

    if (!amountWei || !tenureMonths) {
      return res.status(400).json({ success: false, message: "Amount and tenure required" });
    }
    if (req.user.kyc_status !== "verified") {
      return res.status(403).json({ success: false, message: "KYC must be verified before applying" });
    }

    const pool = getPool();

    // Calculate credit score
    const creditScore = await calculateCreditScore(req.user.id, amountWei, pool);

    // Generate loan ID (matches blockchain derivation)
    const { Web3 } = require("web3");
    const web3 = new Web3();
    const loanIdHash = web3.utils.soliditySha3(
      req.user.wallet_address, Date.now(), amountWei
    );

    // Determine initial status based on score
    const initialStatus = creditScore < 500 ? "REJECTED" : "PENDING";
    const rejectReason  = creditScore < 500 ? "Credit score below minimum threshold (500)" : null;

    // Save to MySQL
    const [result] = await pool.execute(`
      INSERT INTO loans
        (loan_id_hash, borrower_id, amount_wei, interest_rate,
         tenure_months, collateral, status, credit_score)
      VALUES (?,?,?,?,?,?,?,?)
    `, [loanIdHash, req.user.id, amountWei, interestRate || 1200,
        tenureMonths, collateral, initialStatus, creditScore]);

    const loanDbId = result.insertId;

    // Sync credit score to blockchain
    try {
      const tx = await setCreditScoreOnChain(loanIdHash, creditScore);
      await pool.execute(
        "UPDATE loans SET tx_hash_created=? WHERE id=?",
        [tx.transactionHash, loanDbId]
      );
    } catch (chainErr) {
      console.warn("Blockchain sync failed (non-fatal):", chainErr.message);
    }

    // Initialize milestones if not auto-rejected
    if (initialStatus !== "REJECTED") {
      const milestones = [
        { stage: 1, pct: 20 },
        { stage: 2, pct: 30 },
        { stage: 3, pct: 30 },
        { stage: 4, pct: 20 }
      ];
      for (const m of milestones) {
        await pool.execute(
          "INSERT INTO milestones (loan_id, stage, release_percent) VALUES (?,?,?)",
          [loanDbId, m.stage, m.pct]
        );
      }
    }

    // Audit log
    await pool.execute(`
      INSERT INTO audit_logs (loan_id, actor_wallet, action, details)
      VALUES (?, ?, 'LOAN_APPLIED', ?)
    `, [loanDbId, req.user.wallet_address, JSON.stringify({ creditScore, amountWei })]);

    res.status(201).json({
      success:     true,
      loanId:      loanDbId,
      loanIdHash,
      creditScore,
      status:      initialStatus,
      rejectReason,
      message:     initialStatus === "REJECTED"
        ? "Loan auto-rejected: credit score too low"
        : "Loan application submitted successfully"
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/loans/my ─────────────────────────────────
// Borrower's own loans
router.get("/my", protect, async (req, res) => {
  try {
    const pool = getPool();
    const field = req.user.role === "lender" ? "lender_id" : "borrower_id";
    const [loans] = await pool.execute(`
      SELECT l.*, u.name AS borrower_name, u.wallet_address AS borrower_wallet,
             lu.name AS lender_name
      FROM loans l
      JOIN users u ON u.id = l.borrower_id
      LEFT JOIN users lu ON lu.id = l.lender_id
      WHERE l.${field} = ?
      ORDER BY l.applied_at DESC
    `, [req.user.id]);
    res.json({ success: true, loans });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/loans/pending ─────────────────────────────
// Lender sees all PENDING loans to review
router.get("/pending", protect, authorize("lender","admin"), async (req, res) => {
  try {
    const pool = getPool();
    const [loans] = await pool.execute(`
      SELECT l.*, u.name AS borrower_name, u.email AS borrower_email,
             u.wallet_address AS borrower_wallet,
             k.business_name, k.annual_turnover, k.gst_number
      FROM loans l
      JOIN users u ON u.id = l.borrower_id
      JOIN kyc_documents k ON k.user_id = l.borrower_id
      WHERE l.status = 'PENDING'
      ORDER BY l.applied_at DESC
    `);
    res.json({ success: true, loans });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/loans/all ─────────────────────────────────
// Admin / Government / Auditor sees all loans
router.get("/all", protect, authorize("admin","government","auditor"), async (req, res) => {
  try {
    const pool = getPool();
    const [loans] = await pool.execute(`
      SELECT l.*, u.name AS borrower_name, u.wallet_address AS borrower_wallet,
             lu.name AS lender_name
      FROM loans l
      JOIN users u ON u.id = l.borrower_id
      LEFT JOIN users lu ON lu.id = l.lender_id
      ORDER BY l.applied_at DESC
    `);
    res.json({ success: true, loans });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/loans/:id ────────────────────────────────
router.get("/:id", protect, async (req, res) => {
  try {
    const pool = getPool();
    const [loans] = await pool.execute(`
      SELECT l.*, u.name AS borrower_name, u.wallet_address AS borrower_wallet,
             lu.name AS lender_name, lu.wallet_address AS lender_wallet
      FROM loans l
      JOIN users u ON u.id = l.borrower_id
      LEFT JOIN users lu ON lu.id = l.lender_id
      WHERE l.id = ?
    `, [req.params.id]);

    if (!loans.length) {
      return res.status(404).json({ success: false, message: "Loan not found" });
    }

    const loan = loans[0];

    // Fetch milestones
    const [milestones] = await pool.execute(
      "SELECT * FROM milestones WHERE loan_id=? ORDER BY stage", [loan.id]
    );
    // Fetch repayment schedule
    const [repayments] = await pool.execute(
      "SELECT * FROM repayments WHERE loan_id=? ORDER BY installment_no", [loan.id]
    );

    res.json({ success: true, loan: { ...loan, milestones, repayments } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/loans/:id/approve ───────────────────────
// Lender approves a loan (off-chain first, then they sign on-chain via frontend)
router.post("/:id/approve", protect, authorize("lender"), async (req, res) => {
  try {
    const pool = getPool();
    const [loans] = await pool.execute("SELECT * FROM loans WHERE id=?", [req.params.id]);
    if (!loans.length) return res.status(404).json({ success: false, message: "Loan not found" });

    const loan = loans[0];
    if (loan.status !== "PENDING") {
      return res.status(400).json({ success: false, message: "Loan is not pending" });
    }

    const { txHash } = req.body; // txHash from frontend MetaMask transaction

    await pool.execute(`
      UPDATE loans SET status='APPROVED', lender_id=?, approved_at=NOW(), tx_hash_approved=?
      WHERE id=?
    `, [req.user.id, txHash, req.params.id]);

    await pool.execute(`
      INSERT INTO audit_logs (loan_id, actor_wallet, action, details, tx_hash)
      VALUES (?,?,'LOAN_APPROVED',?,?)
    `, [loan.id, req.user.wallet_address, JSON.stringify({ lenderId: req.user.id }), txHash]);

    res.json({ success: true, message: "Loan approved successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/loans/:id/reject ────────────────────────
router.post("/:id/reject", protect, authorize("lender","admin"), async (req, res) => {
  try {
    const { reason, txHash } = req.body;
    const pool = getPool();
    await pool.execute(`
      UPDATE loans SET status='REJECTED', reject_reason=?, tx_hash_rejected=? WHERE id=?
    `, [reason || "Rejected by lender", txHash, req.params.id]);

    await pool.execute(`
      INSERT INTO audit_logs (loan_id, actor_wallet, action, details, tx_hash)
      VALUES (?,?,'LOAN_REJECTED',?,?)
    `, [req.params.id, req.user.wallet_address, JSON.stringify({ reason }), txHash]);

    res.json({ success: true, message: "Loan rejected" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
