// scripts/deploy.js
const hre = require("hardhat");
const fs  = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with:", deployer.address);
  console.log("Balance:", hre.ethers.formatEther(
    await hre.ethers.provider.getBalance(deployer.address)
  ), "ETH");

  // ── Deploy KYCRegistry ──────────────────────────────
  console.log("\n1. Deploying KYCRegistry...");
  const KYCRegistry = await hre.ethers.getContractFactory("KYCRegistry");
  const kycRegistry = await KYCRegistry.deploy();
  await kycRegistry.waitForDeployment();
  const kycAddress = await kycRegistry.getAddress();
  console.log("   KYCRegistry deployed to:", kycAddress);

  // ── Deploy MicroLoanContract ────────────────────────
  console.log("\n2. Deploying MicroLoanContract...");
  const MicroLoanContract = await hre.ethers.getContractFactory("MicroLoanContract");
  const microLoan = await MicroLoanContract.deploy(kycAddress);
  await microLoan.waitForDeployment();
  const loanAddress = await microLoan.getAddress();
  console.log("   MicroLoanContract deployed to:", loanAddress);

  // ── Save addresses for backend use ─────────────────
  const addresses = {
    KYCRegistry:       kycAddress,
    MicroLoanContract: loanAddress,
    deployer:          deployer.address,
    network:           hre.network.name,
    deployedAt:        new Date().toISOString()
  };

  const outDir = path.join(__dirname, "../backend/config");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, "contractAddresses.json"),
    JSON.stringify(addresses, null, 2)
  );
  console.log("\n✅ Contract addresses saved to backend/config/contractAddresses.json");
  console.log(addresses);

  // ── Copy ABIs for backend ───────────────────────────
  const artifactsDir = path.join(__dirname, "../artifacts/contracts");
  const abiOutDir    = path.join(__dirname, "../backend/config/abis");
  fs.mkdirSync(abiOutDir, { recursive: true });

  ["KYCRegistry", "MicroLoanContract"].forEach(name => {
    const artifact = JSON.parse(
      fs.readFileSync(
        path.join(artifactsDir, `${name}.sol/${name}.json`)
      )
    );
    fs.writeFileSync(
      path.join(abiOutDir, `${name}.json`),
      JSON.stringify(artifact.abi, null, 2)
    );
    console.log(`   ABI saved: ${name}.json`);
  });
}

main()
  .then(() => process.exit(0))
  .catch(err => { console.error(err); process.exit(1); });
