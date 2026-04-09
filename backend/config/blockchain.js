import { Web3 } from "web3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load deployed contract addresses + ABIs
const addresses = JSON.parse(
  fs.readFileSync(path.join(__dirname, "contractAddresses.json"))
);

const kycABI = JSON.parse(
  fs.readFileSync(path.join(__dirname, "abis/KYCRegistry.json"))
);

const loanABI = JSON.parse(
  fs.readFileSync(path.join(__dirname, "abis/MicroLoanContract.json"))
);

// Environment Variables
const RPC_URL = process.env.ETHEREUM_RPC_URL || "http://127.0.0.1:8545";

let PRIVATE_KEY = process.env.ADMIN_PRIVATE_KEY;

if (PRIVATE_KEY) {
  PRIVATE_KEY = PRIVATE_KEY.trim();
}

const web3 = new Web3(RPC_URL);

let blockchainEnabled = true;
let adminAccount = null;
let kycContract = null;
let loanContract = null;

function disableBlockchain(reason) {
  blockchainEnabled = false;
  console.warn(`⚠ Blockchain disabled: ${reason}`);
}

if (!PRIVATE_KEY) {
  disableBlockchain("ADMIN_PRIVATE_KEY not set");
} else if (!PRIVATE_KEY.startsWith("0x")) {
  disableBlockchain("ADMIN_PRIVATE_KEY must start with 0x");
} else if (PRIVATE_KEY.length !== 66) {
  disableBlockchain(`Invalid ADMIN_PRIVATE_KEY length: ${PRIVATE_KEY.length} (expected 66)`);
} else {
  try {
    adminAccount = web3.eth.accounts.privateKeyToAccount(PRIVATE_KEY);
    web3.eth.accounts.wallet.add(adminAccount);
    console.log("✅ Admin wallet loaded:", adminAccount.address);
    kycContract = new web3.eth.Contract(kycABI, addresses.KYCRegistry);
    loanContract = new web3.eth.Contract(loanABI, addresses.MicroLoanContract);
  } catch (e) {
    disableBlockchain(e?.message || "Failed to init web3 signer");
  }
}

// Helper: sign & send transaction
async function sendTx(contractMethod) {
  if (!blockchainEnabled || !adminAccount) {
    throw new Error("Blockchain signer not configured");
  }
  const gas = await contractMethod.estimateGas({
    from: adminAccount.address,
  });

  return contractMethod.send({
    from: adminAccount.address,
    gas: Math.ceil(Number(gas) * 1.2),
  });
}

// KYC Functions
async function storeKYCOnChain(userWallet, dataHash, role) {
  if (!kycContract) throw new Error("KYC contract not configured");
  return sendTx(kycContract.methods.submitKYC(userWallet, dataHash, role));
}

async function verifyKYCOnChain(userWallet, status) {
  if (!kycContract) throw new Error("KYC contract not configured");
  return sendTx(kycContract.methods.verifyKYC(userWallet, status));
}

async function isKYCVerified(userWallet) {
  if (!kycContract) throw new Error("KYC contract not configured");
  return kycContract.methods.isVerified(userWallet).call();
}

// Credit Score
async function setCreditScoreOnChain(loanIdHash, score) {
  if (!loanContract) throw new Error("Loan contract not configured");
  return sendTx(loanContract.methods.setCreditScore(loanIdHash, score));
}

// Loan Status
async function getLoanStatusFromChain(loanIdHash) {
  if (!loanContract) throw new Error("Loan contract not configured");
  const status = await loanContract.methods.getLoanStatus(loanIdHash).call();

  const STATUS_MAP = [
    "PENDING",
    "APPROVED",
    "REJECTED",
    "ACTIVE",
    "COMPLETED",
    "DEFAULTED",
  ];

  return STATUS_MAP[Number(status)];
}

async function markDefaultedOnChain(loanIdHash) {
  if (!loanContract) throw new Error("Loan contract not configured");
  return sendTx(loanContract.methods.markDefaulted(loanIdHash));
}

// Milestone Release
async function verifyAndReleaseMilestone(loanIdHash, milestoneIndex) {
  if (!loanContract) throw new Error("Loan contract not configured");
  return sendTx(
    loanContract.methods.verifyAndReleaseMilestone(loanIdHash, milestoneIndex)
  );
}

// Event Listeners
function listenToEvents(handlers = {}) {
  if (!loanContract) {
    console.warn("⚠ listenToEvents skipped (loanContract not configured)");
    return;
  }
  loanContract.events.LoanCreated({}, (err, event) => {
    if (!err && handlers.LoanCreated) handlers.LoanCreated(event.returnValues);
  });

  loanContract.events.LoanApproved({}, (err, event) => {
    if (!err && handlers.LoanApproved) handlers.LoanApproved(event.returnValues);
  });

  loanContract.events.LoanRejected({}, (err, event) => {
    if (!err && handlers.LoanRejected) handlers.LoanRejected(event.returnValues);
  });

  loanContract.events.MilestoneReleased({}, (err, event) => {
    if (!err && handlers.MilestoneReleased) handlers.MilestoneReleased(event.returnValues);
  });

  loanContract.events.RepaymentMade({}, (err, event) => {
    if (!err && handlers.RepaymentMade) handlers.RepaymentMade(event.returnValues);
  });

  loanContract.events.LoanCompleted({}, (err, event) => {
    if (!err && handlers.LoanCompleted) handlers.LoanCompleted(event.returnValues);
  });

  loanContract.events.LoanDefaulted({}, (err, event) => {
    if (!err && handlers.LoanDefaulted) handlers.LoanDefaulted(event.returnValues);
  });
}

export {
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
  listenToEvents,
};