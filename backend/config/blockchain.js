// backend/config/blockchain.js

const { Web3 } = require("web3");
const fs = require("fs");
const path = require("path");


// ─────────────────────────────────────────────────────────
// Load deployed contract addresses + ABIs
// ─────────────────────────────────────────────────────────
const addresses = JSON.parse(
  fs.readFileSync(path.join(__dirname, "contractAddresses.json"))
);

const kycABI = JSON.parse(
  fs.readFileSync(path.join(__dirname, "abis/KYCRegistry.json"))
);

const loanABI = JSON.parse(
  fs.readFileSync(path.join(__dirname, "abis/MicroLoanContract.json"))
);


// ─────────────────────────────────────────────────────────
// ENVIRONMENT VARIABLES (SAFE LOADING)
// ─────────────────────────────────────────────────────────
const RPC_URL =
  process.env.ETHEREUM_RPC_URL || "http://127.0.0.1:8545";

let PRIVATE_KEY = process.env.ADMIN_PRIVATE_KEY;

// Remove hidden spaces / newline (Windows PowerShell fix)
if (PRIVATE_KEY) {
  PRIVATE_KEY = PRIVATE_KEY.trim();
}

// Validate private key
if (!PRIVATE_KEY) {
  throw new Error("❌ ADMIN_PRIVATE_KEY not found in .env");
}

if (!PRIVATE_KEY.startsWith("0x")) {
  throw new Error("❌ Private key must start with 0x");
}

if (PRIVATE_KEY.length !== 66) {
  throw new Error(
    `❌ Invalid private key length: ${PRIVATE_KEY.length} (expected 66)`
  );
}


// ─────────────────────────────────────────────────────────
// Connect to Ethereum node
// ─────────────────────────────────────────────────────────
const web3 = new Web3(RPC_URL);


// ─────────────────────────────────────────────────────────
// Admin account (backend signer)
// ─────────────────────────────────────────────────────────
const adminAccount = web3.eth.accounts.privateKeyToAccount(PRIVATE_KEY);
web3.eth.accounts.wallet.add(adminAccount);

console.log("✅ Admin wallet loaded:", adminAccount.address);


// ─────────────────────────────────────────────────────────
// Contract instances
// ─────────────────────────────────────────────────────────
const kycContract = new web3.eth.Contract(
  kycABI,
  addresses.KYCRegistry
);

const loanContract = new web3.eth.Contract(
  loanABI,
  addresses.MicroLoanContract
);


// ─────────────────────────────────────────────────────────
// Helper: sign & send transaction
// ─────────────────────────────────────────────────────────
async function sendTx(contractMethod) {
  const gas = await contractMethod.estimateGas({
    from: adminAccount.address
  });

  return contractMethod.send({
    from: adminAccount.address,
    gas: Math.ceil(Number(gas) * 1.2)
  });
}


// ─────────────────────────────────────────────────────────
// KYC FUNCTIONS
// ─────────────────────────────────────────────────────────
async function storeKYCOnChain(userWallet, dataHash, role) {
  return sendTx(
    kycContract.methods.submitKYC(userWallet, dataHash, role)
  );
}

async function verifyKYCOnChain(userWallet, status) {
  return sendTx(
    kycContract.methods.verifyKYC(userWallet, status)
  );
}

async function isKYCVerified(userWallet) {
  return kycContract.methods.isVerified(userWallet).call();
}


// ─────────────────────────────────────────────────────────
// CREDIT SCORE
// ─────────────────────────────────────────────────────────
async function setCreditScoreOnChain(loanIdHash, score) {
  return sendTx(
    loanContract.methods.setCreditScore(loanIdHash, score)
  );
}


// ─────────────────────────────────────────────────────────
// LOAN STATUS
// ─────────────────────────────────────────────────────────
async function getLoanStatusFromChain(loanIdHash) {
  const status = await loanContract.methods
    .getLoanStatus(loanIdHash)
    .call();

  const STATUS_MAP = [
    "PENDING",
    "APPROVED",
    "REJECTED",
    "ACTIVE",
    "COMPLETED",
    "DEFAULTED"
  ];

  return STATUS_MAP[Number(status)];
}

async function markDefaultedOnChain(loanIdHash) {
  return sendTx(
    loanContract.methods.markDefaulted(loanIdHash)
  );
}


// ─────────────────────────────────────────────────────────
// MILESTONE RELEASE
// ─────────────────────────────────────────────────────────
async function verifyAndReleaseMilestone(
  loanIdHash,
  milestoneIndex
) {
  return sendTx(
    loanContract.methods.verifyAndReleaseMilestone(
      loanIdHash,
      milestoneIndex
    )
  );
}


// ─────────────────────────────────────────────────────────
// EVENT LISTENERS
// ─────────────────────────────────────────────────────────
function listenToEvents(handlers = {}) {

  loanContract.events.LoanCreated({}, (err, event) => {
    if (!err && handlers.LoanCreated)
      handlers.LoanCreated(event.returnValues);
  });

  loanContract.events.LoanApproved({}, (err, event) => {
    if (!err && handlers.LoanApproved)
      handlers.LoanApproved(event.returnValues);
  });

  loanContract.events.LoanRejected({}, (err, event) => {
    if (!err && handlers.LoanRejected)
      handlers.LoanRejected(event.returnValues);
  });

  loanContract.events.MilestoneReleased({}, (err, event) => {
    if (!err && handlers.MilestoneReleased)
      handlers.MilestoneReleased(event.returnValues);
  });

  loanContract.events.RepaymentMade({}, (err, event) => {
    if (!err && handlers.RepaymentMade)
      handlers.RepaymentMade(event.returnValues);
  });

  loanContract.events.LoanCompleted({}, (err, event) => {
    if (!err && handlers.LoanCompleted)
      handlers.LoanCompleted(event.returnValues);
  });

  loanContract.events.LoanDefaulted({}, (err, event) => {
    if (!err && handlers.LoanDefaulted)
      handlers.LoanDefaulted(event.returnValues);
  });
}


// ─────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────
module.exports = {
  web3,
  kycContract,
  loanContract,
  adminAccount,
  storeKYCOnChain,
  verifyKYCOnChain,
  isKYCVerified,
  setCreditScoreOnChain,
  getLoanStatusFromChain,
  markDefaultedOnChain,
  verifyAndReleaseMilestone,
  listenToEvents
};