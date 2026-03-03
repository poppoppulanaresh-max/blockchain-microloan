// frontend/src/context/Web3Context.jsx
import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import MicroLoanABI    from "../abis/MicroLoanContract.json";
import KYCRegistryABI  from "../abis/KYCRegistry.json";
import contractAddresses from "../config/contractAddresses.json";

const Web3Context = createContext(null);

export function Web3Provider({ children }) {
  const [provider,       setProvider]       = useState(null);
  const [signer,         setSigner]         = useState(null);
  const [account,        setAccount]        = useState(null);
  const [chainId,        setChainId]        = useState(null);
  const [loanContract,   setLoanContract]   = useState(null);
  const [kycContract,    setKycContract]    = useState(null);
  const [connected,      setConnected]      = useState(false);
  const [loading,        setLoading]        = useState(false);
  const [error,          setError]          = useState(null);

  // ── Connect MetaMask ─────────────────────────────────
  const connectWallet = useCallback(async () => {
    if (!window.ethereum) {
      setError("MetaMask not installed. Please install MetaMask.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await window.ethereum.request({ method: "eth_requestAccounts" });

      const ethProvider  = new ethers.BrowserProvider(window.ethereum);
      const ethSigner    = await ethProvider.getSigner();
      const addr         = await ethSigner.getAddress();
      const network      = await ethProvider.getNetwork();

      const loan = new ethers.Contract(
        contractAddresses.MicroLoanContract, MicroLoanABI, ethSigner
      );
      const kyc = new ethers.Contract(
        contractAddresses.KYCRegistry, KYCRegistryABI, ethSigner
      );

      setProvider(ethProvider);
      setSigner(ethSigner);
      setAccount(addr);
      setChainId(network.chainId.toString());
      setLoanContract(loan);
      setKycContract(kyc);
      setConnected(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Disconnect ────────────────────────────────────────
  const disconnect = () => {
    setProvider(null); setSigner(null); setAccount(null);
    setLoanContract(null); setKycContract(null); setConnected(false);
  };

  // ── Listen for account / chain changes ───────────────
  useEffect(() => {
    if (!window.ethereum) return;
    const handleAccChange = (accounts) => {
      if (accounts.length === 0) disconnect();
      else setAccount(accounts[0]);
    };
    const handleChainChange = () => window.location.reload();
    window.ethereum.on("accountsChanged", handleAccChange);
    window.ethereum.on("chainChanged",    handleChainChange);
    return () => {
      window.ethereum.removeListener("accountsChanged", handleAccChange);
      window.ethereum.removeListener("chainChanged",    handleChainChange);
    };
  }, []);

  // ── Blockchain actions ────────────────────────────────

  /** Borrower applies for loan via smart contract */
  async function applyLoanOnChain(amountWei, interestRate, tenureMonths, collateral) {
    const tx = await loanContract.applyForLoan(
      amountWei, interestRate, tenureMonths, collateral
    );
    return tx.wait();
  }

  /** Lender approves loan on-chain */
  async function approveLoanOnChain(loanIdHash) {
    const tx = await loanContract.approveLoan(loanIdHash);
    return tx.wait();
  }

  /** Lender rejects loan on-chain */
  async function rejectLoanOnChain(loanIdHash, reason) {
    const tx = await loanContract.rejectLoan(loanIdHash, reason);
    return tx.wait();
  }

  /** Lender deposits ETH into escrow + triggers milestone 1 */
  async function depositFundsOnChain(loanIdHash, amountWei) {
    const tx = await loanContract.depositFunds(loanIdHash, { value: amountWei });
    return tx.wait();
  }

  /** Borrower submits milestone proof */
  async function submitMilestoneProof(loanIdHash, milestoneIndex, proofHash) {
    const tx = await loanContract.submitMilestoneProof(loanIdHash, milestoneIndex, proofHash);
    return tx.wait();
  }

  /** Borrower makes EMI repayment */
  async function makeRepaymentOnChain(loanIdHash, installment, amountWei) {
    const tx = await loanContract.makeRepayment(loanIdHash, installment, { value: amountWei });
    return tx.wait();
  }

  return (
    <Web3Context.Provider value={{
      provider, signer, account, chainId,
      loanContract, kycContract, connected, loading, error,
      connectWallet, disconnect,
      applyLoanOnChain, approveLoanOnChain, rejectLoanOnChain,
      depositFundsOnChain, submitMilestoneProof, makeRepaymentOnChain
    }}>
      {children}
    </Web3Context.Provider>
  );
}

export const useWeb3 = () => useContext(Web3Context);
