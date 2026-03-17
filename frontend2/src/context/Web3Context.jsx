// frontend2/src/context/Web3Context.jsx
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef
} from "react";
import { ethers } from "ethers";
import MicroLoanABI from "../abis/MicroLoanContract.json";
import KYCRegistryABI from "../abis/KYCRegistry.json";
import contractAddresses from "../config/contractAddresses.json";

const Web3Context = createContext(null);

export function Web3Provider({ children }) {
  const [provider, setProvider]       = useState(null);
  const [signer, setSigner]           = useState(null);
  const [account, setAccount]         = useState(null);
  const [chainId, setChainId]         = useState(null);
  const [loanContract, setLoanContract] = useState(null);
  const [kycContract, setKycContract]   = useState(null);
  const [connected, setConnected]     = useState(false);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState(null);

  // Prevent double-init on strict mode
  const initDone = useRef(false);

  // ─── Init contracts from a signer ───────────────────────────────────────────
  const initContracts = useCallback(async (ethSigner) => {
    const loan = new ethers.Contract(
      contractAddresses.MicroLoanContract,
      MicroLoanABI.abi,
      ethSigner
    );
    const kyc = new ethers.Contract(
      contractAddresses.KYCRegistry,
      KYCRegistryABI.abi,
      ethSigner
    );
    setLoanContract(loan);
    setKycContract(kyc);
    return { loan, kyc };
  }, []);

  // ─── Shared setup: given a provider, wire up signer + contracts ──────────────
  const setupFromProvider = useCallback(async (ethProvider) => {
    const ethSigner = await ethProvider.getSigner();
    const address   = await ethSigner.getAddress();
    const network   = await ethProvider.getNetwork();

    setProvider(ethProvider);
    setSigner(ethSigner);
    setAccount(address);
    setChainId(network.chainId.toString());
    await initContracts(ethSigner);
    setConnected(true);
    return address;
  }, [initContracts]);

  // ─── Auto-reconnect (no popup) ───────────────────────────────────────────────
  useEffect(() => {
    if (initDone.current) return;
    initDone.current = true;

    async function autoConnect() {
      if (!window.ethereum) return;
      try {
        // eth_accounts returns already-authorised accounts WITHOUT a popup
        const accounts = await window.ethereum.request({ method: "eth_accounts" });
        if (accounts.length === 0) return;                // not connected yet — wait for user to click
        const ethProvider = new ethers.BrowserProvider(window.ethereum);
        await setupFromProvider(ethProvider);
      } catch (err) {
        console.error("Auto-connect failed:", err);
      }
    }

    autoConnect();
  }, [setupFromProvider]);

  // ─── Connect (user-initiated, shows popup only when truly needed) ────────────
  const connectWallet = useCallback(async () => {
    if (!window.ethereum) {
      setError("MetaMask not installed. Please install MetaMask.");
      return;
    }

    // If already connected, do nothing
    if (connected && account) return;

    try {
      setLoading(true);
      setError(null);

      // Check if already authorised first — avoids unnecessary popup
      const existingAccounts = await window.ethereum.request({ method: "eth_accounts" });
      if (existingAccounts.length === 0) {
        // Only request accounts (popup) when we truly have none
        await window.ethereum.request({ method: "eth_requestAccounts" });
      }

      const ethProvider = new ethers.BrowserProvider(window.ethereum);
      await setupFromProvider(ethProvider);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [connected, account, setupFromProvider]);

  // ─── Listen for MetaMask account / chain changes ─────────────────────────────
  useEffect(() => {
    if (!window.ethereum) return;

    const handleAccountsChanged = async (accounts) => {
      if (accounts.length === 0) {
        disconnect();
      } else {
        // Re-wire signer + contracts for the new account — fixes "wrong account" bug
        try {
          const ethProvider = new ethers.BrowserProvider(window.ethereum);
          await setupFromProvider(ethProvider);
        } catch (err) {
          console.error("Account change re-init failed:", err);
        }
      }
    };

    const handleChainChanged = () => window.location.reload();

    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);

    return () => {
      window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
      window.ethereum.removeListener("chainChanged", handleChainChanged);
    };
  }, [setupFromProvider]);

  // ─── Disconnect ───────────────────────────────────────────────────────────────
  const disconnect = () => {
    setProvider(null);
    setSigner(null);
    setAccount(null);
    setChainId(null);
    setLoanContract(null);
    setKycContract(null);
    setConnected(false);
  };

  // ─── Guard ────────────────────────────────────────────────────────────────────
  async function ensureWalletConnectedAsync() {
    if (connected && loanContract) return;
    if (!window.ethereum) throw new Error("MetaMask wallet not connected.");
    
    // Check if we can connect seamlessly or just wait for setup
    const ethProvider = new ethers.BrowserProvider(window.ethereum);
    const ethSigner = await ethProvider.getSigner();
    
    // Wire immediately
    const loan = new ethers.Contract(
      contractAddresses.MicroLoanContract,
      MicroLoanABI.abi,
      ethSigner
    );
    const kyc = new ethers.Contract(
      contractAddresses.KYCRegistry,
      KYCRegistryABI.abi,
      ethSigner
    );
    
    setProvider(ethProvider);
    setSigner(ethSigner);
    setLoanContract(loan);
    setKycContract(kyc);
    setConnected(true);
    
    return { loan, kyc };
  }

  // ─── Contract helpers ─────────────────────────────────────────────────────────

  async function applyLoanOnChain(amountWei, interestRate, tenureMonths, collateral) {
    const instance = await ensureWalletConnectedAsync();
    const currentLoan = instance?.loan || loanContract;
    // interestRate must be a plain integer (e.g. 10 for 10%) — fixes PCT field error
    const tx = await currentLoan.applyForLoan(
      amountWei,
      Number(interestRate),   // ensure it's a number, not a string
      Number(tenureMonths),
      collateral
    );
    return tx.wait();
  }

  async function approveLoanOnChain(loanIdHash) {
    const instance = await ensureWalletConnectedAsync();
    const currentLoan = instance?.loan || loanContract;
    const tx = await currentLoan.approveLoan(loanIdHash);
    return tx.wait();
  }

  async function rejectLoanOnChain(loanIdHash, reason) {
    const instance = await ensureWalletConnectedAsync();
    const currentLoan = instance?.loan || loanContract;
    const tx = await currentLoan.rejectLoan(loanIdHash, reason);
    return tx.wait();
  }

  async function depositFundsOnChain(loanIdHash, amountWei) {
    const instance = await ensureWalletConnectedAsync();
    const currentLoan = instance?.loan || loanContract;
    const tx = await currentLoan.depositFunds(loanIdHash, { value: amountWei });
    return tx.wait();
  }

  async function submitMilestoneProof(loanIdHash, milestoneIndex, proofHash) {
    const instance = await ensureWalletConnectedAsync();
    const currentLoan = instance?.loan || loanContract;
    const tx = await currentLoan.submitMilestoneProof(loanIdHash, milestoneIndex, proofHash);
    return tx.wait();
  }

  async function makeRepaymentOnChain(loanIdHash, installment, amountWei) {
    const instance = await ensureWalletConnectedAsync();
    const currentLoan = instance?.loan || loanContract;
    const tx = await currentLoan.makeRepayment(loanIdHash, installment, { value: amountWei });
    return tx.wait();
  }

  // ─── KYC helpers (used by auditor verify) ────────────────────────────────────

  async function verifyKYCOnChain(userAddress) {
    const instance = await ensureWalletConnectedAsync();
    const currentKyc = instance?.kyc || kycContract;
    const tx = await currentKyc.verifyKYC(userAddress, true);
    return tx.wait();
  }

  async function rejectKYCOnChain(userAddress, reason) {
    const instance = await ensureWalletConnectedAsync();
    const currentKyc = instance?.kyc || kycContract;
    const tx = await currentKyc.verifyKYC(userAddress, false);
    return tx.wait();
  }

  async function getKYCStatus(userAddress) {
    if (!kycContract) return null;
    return kycContract.getKYCStatus(userAddress);
  }

  // ─── Provider ────────────────────────────────────────────────────────────────
  return (
    <Web3Context.Provider value={{
      provider, signer, account, chainId,
      loanContract, kycContract,
      connected, loading, error,
      connectWallet, disconnect,
      applyLoanOnChain,
      approveLoanOnChain,
      rejectLoanOnChain,
      depositFundsOnChain,
      submitMilestoneProof,
      makeRepaymentOnChain,
      verifyKYCOnChain,
      rejectKYCOnChain,
      getKYCStatus,
    }}>
      {children}
    </Web3Context.Provider>
  );
}

export const useWeb3 = () => useContext(Web3Context);
