// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./KYCRegistry.sol";

/**
 * @title MicroLoanContract
 * @dev Core smart contract for Blockchain-Based Decentralized Micro-Loan Management
 *      Implements: Loan creation, Lender approval/rejection, Escrow,
 *                  Milestone-based (4-stage) fund release, Repayment, Penalty
 *
 * Architecture (from B19 PPT):
 *   Borrower → apply → SmartContract (PENDING)
 *   CreditEngine → updateScore
 *   Lender → approve/reject
 *   Lender → depositFunds (escrow)
 *   Milestone 1 (20%): auto on approval
 *   Milestone 2 (30%): after bill1 verified
 *   Milestone 3 (30%): after bill2 verified
 *   Milestone 4 (20%): after final proof
 *   Borrower → repay EMI → lender
 *   Late → penalty auto-applied
 */
contract MicroLoanContract {

    KYCRegistry public kycRegistry;
    address     public admin;

    // ── Enums ──────────────────────────────────────────
    enum LoanStatus {
        PENDING,     // 0 - submitted, awaiting credit check
        APPROVED,    // 1 - lender approved
        REJECTED,    // 2 - rejected (auto or manual)
        ACTIVE,      // 3 - funds disbursed, repayment ongoing
        COMPLETED,   // 4 - fully repaid
        DEFAULTED    // 5 - missed payments, defaulted
    }

    enum MilestoneStatus { PENDING, SUBMITTED, RELEASED }

    // ── Structs ────────────────────────────────────────
    struct Milestone {
        uint8           stage;          // 1-4
        uint256         releasePercent; // 20, 30, 30, 20
        bytes32         proofHash;      // hash of bill/invoice
        MilestoneStatus status;
        uint256         releasedAt;
        uint256         amountReleased;
    }

    struct RepaymentSchedule {
        uint256 emiAmount;
        uint256 dueDate;
        bool    paid;
        uint256 paidAt;
        uint256 penaltyApplied;
    }

    struct Loan {
        bytes32    loanId;
        address    borrower;
        address    lender;
        uint256    amount;           // total loan amount in Wei
        uint256    interestRate;     // annual % * 100 (e.g. 1200 = 12%)
        uint256    tenureMonths;
        string     collateral;
        LoanStatus status;
        uint256    creditScore;
        uint256    escrowBalance;
        uint256    totalRepaid;
        uint256    appliedAt;
        uint256    approvedAt;
        uint256    completedAt;
        Milestone[4]         milestones;
        RepaymentSchedule[]  repayments;
    }

    // ── State ──────────────────────────────────────────
    mapping(bytes32 => Loan)    public loans;
    mapping(address => bytes32[]) public borrowerLoans;
    mapping(address => bytes32[]) public lenderLoans;
    bytes32[] public allLoanIds;

    uint256 public constant PENALTY_RATE  = 2;   // 2% per month late fee
    uint256 public constant MIN_SCORE     = 500;  // auto-reject below this

    // ── Events ─────────────────────────────────────────
    event LoanCreated    (bytes32 indexed loanId, address borrower, uint256 amount);
    event CreditScoreSet (bytes32 indexed loanId, uint256 score);
    event LoanApproved   (bytes32 indexed loanId, address lender);
    event LoanRejected   (bytes32 indexed loanId, string reason);
    event FundsDeposited (bytes32 indexed loanId, uint256 amount);
    event MilestoneProofSubmitted(bytes32 indexed loanId, uint8 stage, bytes32 proofHash);
    event MilestoneReleased(bytes32 indexed loanId, uint8 stage, uint256 amount);
    event RepaymentMade  (bytes32 indexed loanId, uint256 installment, uint256 amount);
    event PenaltyApplied (bytes32 indexed loanId, uint256 installment, uint256 penalty);
    event LoanCompleted  (bytes32 indexed loanId);
    event LoanDefaulted  (bytes32 indexed loanId);

    // ── Modifiers ──────────────────────────────────────
    modifier onlyAdmin()    { require(msg.sender == admin,           "Only admin");    _; }
    modifier onlyBorrower(bytes32 loanId) {
        require(msg.sender == loans[loanId].borrower, "Only borrower"); _;
    }
    modifier onlyLender(bytes32 loanId) {
        require(msg.sender == loans[loanId].lender,   "Only lender");  _;
    }
    modifier loanExists(bytes32 loanId) {
        require(loans[loanId].appliedAt > 0,          "Loan not found"); _;
    }

    // ── Constructor ────────────────────────────────────
    constructor(address _kycRegistry) {
        admin       = msg.sender;
        kycRegistry = KYCRegistry(_kycRegistry);
    }

    // ══════════════════════════════════════════════════
    //   PHASE 1 — LOAN APPLICATION
    // ══════════════════════════════════════════════════

    /**
     * @notice Borrower submits a loan application
     * @param amount      Loan amount in Wei
     * @param interestRate Annual rate * 100 (e.g. 1200 = 12%)
     * @param tenureMonths Repayment period in months
     * @param collateral   Description of collateral (stored as string)
     */
    function applyForLoan(
        uint256 amount,
        uint256 interestRate,
        uint256 tenureMonths,
        string calldata collateral
    ) external returns (bytes32 loanId) {
        require(kycRegistry.isVerified(msg.sender), "KYC not verified");
        require(amount > 0,          "Amount must be > 0");
        require(tenureMonths > 0,    "Tenure must be > 0");

        loanId = keccak256(abi.encodePacked(msg.sender, block.timestamp, amount));

        Loan storage loan = loans[loanId];
        loan.loanId       = loanId;
        loan.borrower     = msg.sender;
        loan.amount       = amount;
        loan.interestRate = interestRate;
        loan.tenureMonths = tenureMonths;
        loan.collateral   = collateral;
        loan.status       = LoanStatus.PENDING;
        loan.appliedAt    = block.timestamp;

        // Initialize 4 milestones: 20%, 30%, 30%, 20%
        loan.milestones[0] = Milestone(1, 20, bytes32(0), MilestoneStatus.PENDING, 0, 0);
        loan.milestones[1] = Milestone(2, 30, bytes32(0), MilestoneStatus.PENDING, 0, 0);
        loan.milestones[2] = Milestone(3, 30, bytes32(0), MilestoneStatus.PENDING, 0, 0);
        loan.milestones[3] = Milestone(4, 20, bytes32(0), MilestoneStatus.PENDING, 0, 0);

        borrowerLoans[msg.sender].push(loanId);
        allLoanIds.push(loanId);

        emit LoanCreated(loanId, msg.sender, amount);
    }

    // ══════════════════════════════════════════════════
    //   PHASE 2 — CREDIT EVALUATION (called by backend)
    // ══════════════════════════════════════════════════

    /**
     * @notice Backend credit engine sets score; auto-rejects if below MIN_SCORE
     */
    function setCreditScore(bytes32 loanId, uint256 score)
        external onlyAdmin loanExists(loanId)
    {
        Loan storage loan = loans[loanId];
        require(loan.status == LoanStatus.PENDING, "Not pending");
        loan.creditScore = score;
        emit CreditScoreSet(loanId, score);

        if (score < MIN_SCORE) {
            loan.status = LoanStatus.REJECTED;
            emit LoanRejected(loanId, "Credit score below minimum threshold");
        }
    }

    // ══════════════════════════════════════════════════
    //   PHASE 3 — LENDER APPROVAL / REJECTION
    // ══════════════════════════════════════════════════

    /**
     * @notice Lender assigns themselves to a loan and approves it
     */
    function approveLoan(bytes32 loanId) external loanExists(loanId) {
        Loan storage loan = loans[loanId];
        require(loan.status == LoanStatus.PENDING,   "Loan not pending");
        require(loan.creditScore >= MIN_SCORE,        "Credit score too low");
        require(kycRegistry.isVerified(msg.sender),  "Lender KYC not verified");

        loan.lender     = msg.sender;
        loan.status     = LoanStatus.APPROVED;
        loan.approvedAt = block.timestamp;
        lenderLoans[msg.sender].push(loanId);

        emit LoanApproved(loanId, msg.sender);
    }

    /**
     * @notice Lender or admin rejects a loan
     */
    function rejectLoan(bytes32 loanId, string calldata reason)
        external loanExists(loanId)
    {
        Loan storage loan = loans[loanId];
        require(
            msg.sender == admin || msg.sender == loan.lender,
            "Not authorized"
        );
        require(loan.status == LoanStatus.PENDING || loan.status == LoanStatus.APPROVED,
            "Cannot reject");

        loan.status = LoanStatus.REJECTED;
        emit LoanRejected(loanId, reason);
    }

    // ══════════════════════════════════════════════════
    //   PHASE 4 — FUND DEPOSIT INTO ESCROW
    // ══════════════════════════════════════════════════

    /**
     * @notice Lender deposits ETH equal to loan amount into escrow
     *         AND triggers Stage-1 (20%) auto-release
     */
    function depositFunds(bytes32 loanId)
        external payable onlyLender(loanId) loanExists(loanId)
    {
        Loan storage loan = loans[loanId];
        require(loan.status == LoanStatus.APPROVED, "Loan not approved");
        require(msg.value == loan.amount,           "Must deposit exact loan amount");

        loan.escrowBalance = msg.value;
        loan.status        = LoanStatus.ACTIVE;

        emit FundsDeposited(loanId, msg.value);

        // Auto-release Milestone 1 (20%) immediately
        _releaseMilestone(loanId, 0, bytes32(0));

        // Build repayment schedule
        _buildRepaymentSchedule(loanId);
    }

    // ══════════════════════════════════════════════════
    //   PHASE 5 — MILESTONE-BASED FUND RELEASE
    // ══════════════════════════════════════════════════

    /**
     * @notice Borrower submits proof (bill/invoice hash) for milestone 2, 3, or 4
     */
    function submitMilestoneProof(bytes32 loanId, uint8 milestoneIndex, bytes32 proofHash)
        external onlyBorrower(loanId) loanExists(loanId)
    {
        require(milestoneIndex >= 1 && milestoneIndex <= 3, "Invalid milestone (1-3 only)");
        Loan storage loan = loans[loanId];
        require(loan.status == LoanStatus.ACTIVE, "Loan not active");
        require(loan.milestones[milestoneIndex].status == MilestoneStatus.PENDING,
            "Already submitted");
        // Previous milestone must be released
        require(loan.milestones[milestoneIndex - 1].status == MilestoneStatus.RELEASED,
            "Previous milestone not released");

        loan.milestones[milestoneIndex].proofHash = proofHash;
        loan.milestones[milestoneIndex].status    = MilestoneStatus.SUBMITTED;

        emit MilestoneProofSubmitted(loanId, milestoneIndex + 1, proofHash);
    }

    /**
     * @notice Admin/lender verifies proof and releases milestone funds
     */
    function verifyAndReleaseMilestone(bytes32 loanId, uint8 milestoneIndex)
        external loanExists(loanId)
    {
        require(
            msg.sender == admin || msg.sender == loans[loanId].lender,
            "Not authorized"
        );
        require(milestoneIndex >= 1 && milestoneIndex <= 3, "Invalid milestone");
        require(
            loans[loanId].milestones[milestoneIndex].status == MilestoneStatus.SUBMITTED,
            "Proof not submitted"
        );

        _releaseMilestone(loanId, milestoneIndex, loans[loanId].milestones[milestoneIndex].proofHash);
    }

    /**
     * @dev Internal: calculate and transfer milestone amount
     */
    function _releaseMilestone(bytes32 loanId, uint8 idx, bytes32 proofHash) internal {
        Loan storage loan = loans[loanId];
        uint256 percent   = loan.milestones[idx].releasePercent;
        uint256 amount    = (loan.amount * percent) / 100;

        require(loan.escrowBalance >= amount, "Insufficient escrow");

        loan.milestones[idx].proofHash      = proofHash;
        loan.milestones[idx].status         = MilestoneStatus.RELEASED;
        loan.milestones[idx].releasedAt     = block.timestamp;
        loan.milestones[idx].amountReleased = amount;
        loan.escrowBalance                 -= amount;

        payable(loan.borrower).transfer(amount);
        emit MilestoneReleased(loanId, idx + 1, amount);
    }

    // ══════════════════════════════════════════════════
    //   PHASE 6 — REPAYMENT
    // ══════════════════════════════════════════════════

    function _buildRepaymentSchedule(bytes32 loanId) internal {
        Loan storage loan = loans[loanId];
        uint256 principal = loan.amount;
        uint256 monthly   = (principal * loan.interestRate) / (100 * 100 * 12);
        uint256 emi       = (principal / loan.tenureMonths) + monthly;

        for (uint256 i = 0; i < loan.tenureMonths; i++) {
            loan.repayments.push(RepaymentSchedule({
                emiAmount:      emi,
                dueDate:        block.timestamp + ((i + 1) * 30 days),
                paid:           false,
                paidAt:         0,
                penaltyApplied: 0
            }));
        }
    }

    /**
     * @notice Borrower pays an EMI installment
     * @param loanId        The loan ID
     * @param installment   0-based index of the repayment installment
     */
    function makeRepayment(bytes32 loanId, uint256 installment)
        external payable onlyBorrower(loanId) loanExists(loanId)
    {
        Loan storage loan = loans[loanId];
        require(loan.status == LoanStatus.ACTIVE, "Loan not active");
        require(installment < loan.repayments.length, "Invalid installment");

        RepaymentSchedule storage sched = loan.repayments[installment];
        require(!sched.paid, "Already paid");

        uint256 penalty = 0;
        if (block.timestamp > sched.dueDate) {
            // Calculate late penalty: 2% of EMI per month late
            uint256 monthsLate = (block.timestamp - sched.dueDate) / 30 days + 1;
            penalty = (sched.emiAmount * PENALTY_RATE * monthsLate) / 100;
            sched.penaltyApplied = penalty;
            emit PenaltyApplied(loanId, installment, penalty);
        }

        uint256 totalDue = sched.emiAmount + penalty;
        require(msg.value >= totalDue, "Insufficient payment");

        sched.paid   = true;
        sched.paidAt = block.timestamp;
        loan.totalRepaid += msg.value;

        // Forward payment to lender
        payable(loan.lender).transfer(msg.value);
        emit RepaymentMade(loanId, installment, msg.value);

        // Check if fully repaid
        if (_allRepaid(loan)) {
            loan.status      = LoanStatus.COMPLETED;
            loan.completedAt = block.timestamp;
            emit LoanCompleted(loanId);
        }
    }

    function _allRepaid(Loan storage loan) internal view returns (bool) {
        for (uint256 i = 0; i < loan.repayments.length; i++) {
            if (!loan.repayments[i].paid) return false;
        }
        return true;
    }

    /**
     * @notice Admin can mark a loan as DEFAULTED if borrower misses payments
     */
    function markDefaulted(bytes32 loanId) external onlyAdmin loanExists(loanId) {
        Loan storage loan = loans[loanId];
        require(loan.status == LoanStatus.ACTIVE, "Loan not active");
        loan.status = LoanStatus.DEFAULTED;
        emit LoanDefaulted(loanId);
    }

    // ══════════════════════════════════════════════════
    //   VIEW FUNCTIONS
    // ══════════════════════════════════════════════════

    function getLoanStatus(bytes32 loanId) external view returns (LoanStatus) {
        return loans[loanId].status;
    }

    function getLoanCore(bytes32 loanId) external view returns (
        address borrower, address lender, uint256 amount,
        uint256 interestRate, uint256 tenureMonths, LoanStatus status,
        uint256 creditScore, uint256 escrowBalance, uint256 totalRepaid
    ) {
        Loan storage l = loans[loanId];
        return (l.borrower, l.lender, l.amount, l.interestRate,
                l.tenureMonths, l.status, l.creditScore, l.escrowBalance, l.totalRepaid);
    }

    function getMilestone(bytes32 loanId, uint8 idx) external view returns (Milestone memory) {
        return loans[loanId].milestones[idx];
    }

    function getRepaymentSchedule(bytes32 loanId) external view returns (RepaymentSchedule[] memory) {
        return loans[loanId].repayments;
    }

    function getBorrowerLoans(address borrower) external view returns (bytes32[] memory) {
        return borrowerLoans[borrower];
    }

    function getLenderLoans(address lender) external view returns (bytes32[] memory) {
        return lenderLoans[lender];
    }

    function getAllLoans() external view returns (bytes32[] memory) {
        return allLoanIds;
    }

    function getTotalLoans() external view returns (uint256) {
        return allLoanIds.length;
    }
}
