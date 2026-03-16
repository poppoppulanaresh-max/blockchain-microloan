// frontend/src/context/Web3Context.jsx

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback
} from "react";

import { ethers } from "ethers";

import MicroLoanABI from "../abis/MicroLoanContract.json";
import KYCRegistryABI from "../abis/KYCRegistry.json";
import contractAddresses from "../config/contractAddresses.json";

const Web3Context = createContext(null);

export function Web3Provider({ children }) {

  const [provider,setProvider] = useState(null);
  const [signer,setSigner] = useState(null);
  const [account,setAccount] = useState(null);
  const [chainId,setChainId] = useState(null);

  const [loanContract,setLoanContract] = useState(null);
  const [kycContract,setKycContract] = useState(null);

  const [connected,setConnected] = useState(false);
  const [loading,setLoading] = useState(false);
  const [error,setError] = useState(null);

  // ─────────────────────────────────
  // Initialize contracts
  // ─────────────────────────────────

  const initContracts = async (ethSigner) => {

    const loan = new ethers.Contract(
      contractAddresses.MicroLoanContract,
      MicroLoanABI,
      ethSigner
    );

    const kyc = new ethers.Contract(
      contractAddresses.KYCRegistry,
      KYCRegistryABI,
      ethSigner
    );

    setLoanContract(loan);
    setKycContract(kyc);

  };


  // ─────────────────────────────────
  // Connect MetaMask
  // ─────────────────────────────────

  const connectWallet = useCallback(async () => {

    if (!window.ethereum) {
      setError("MetaMask not installed. Please install MetaMask.");
      return;
    }

    try {

      setLoading(true);
      setError(null);

      await window.ethereum.request({
        method: "eth_requestAccounts"
      });

      const ethProvider = new ethers.BrowserProvider(window.ethereum);
      const ethSigner = await ethProvider.getSigner();

      const address = await ethSigner.getAddress();
      const network = await ethProvider.getNetwork();

      setProvider(ethProvider);
      setSigner(ethSigner);
      setAccount(address);
      setChainId(network.chainId.toString());

      await initContracts(ethSigner);

      setConnected(true);

    } catch (err) {

      console.error(err);
      setError(err.message);

    } finally {

      setLoading(false);

    }

  }, []);


  // ─────────────────────────────────
  // Auto reconnect wallet
  // ─────────────────────────────────

  useEffect(() => {

    async function autoConnect() {

      if (!window.ethereum) return;

      const accounts = await window.ethereum.request({
        method: "eth_accounts"
      });

      if (accounts.length === 0) return;

      const ethProvider = new ethers.BrowserProvider(window.ethereum);
      const ethSigner = await ethProvider.getSigner();

      const address = await ethSigner.getAddress();
      const network = await ethProvider.getNetwork();

      setProvider(ethProvider);
      setSigner(ethSigner);
      setAccount(address);
      setChainId(network.chainId.toString());

      await initContracts(ethSigner);

      setConnected(true);

    }

    autoConnect();

  }, []);


  // ─────────────────────────────────
  // Listen for MetaMask changes
  // ─────────────────────────────────

  useEffect(() => {

    if (!window.ethereum) return;

    const handleAccountsChanged = (accounts) => {

      if (accounts.length === 0) {
        disconnect();
      } else {
        setAccount(accounts[0]);
      }

    };

    const handleChainChanged = () => {
      window.location.reload();
    };

    window.ethereum.on("accountsChanged", handleAccountsChanged);
    window.ethereum.on("chainChanged", handleChainChanged);

    return () => {
      window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
      window.ethereum.removeListener("chainChanged", handleChainChanged);
    };

  }, []);


  // ─────────────────────────────────
  // Disconnect wallet
  // ─────────────────────────────────

  const disconnect = () => {

    setProvider(null);
    setSigner(null);
    setAccount(null);
    setChainId(null);

    setLoanContract(null);
    setKycContract(null);

    setConnected(false);

  };


  // ─────────────────────────────────
  // Safety check
  // ─────────────────────────────────

  function ensureWalletConnected() {

    if (!connected || !loanContract) {
      throw new Error("MetaMask wallet not connected.");
    }

  }


  // ─────────────────────────────────
  // Smart Contract Functions
  // ─────────────────────────────────

  async function applyLoanOnChain(amountWei, interestRate, tenureMonths, collateral) {

    ensureWalletConnected();

    const tx = await loanContract.applyForLoan(
      amountWei,
      interestRate,
      tenureMonths,
      collateral
    );

    return tx.wait();

  }


  async function approveLoanOnChain(loanIdHash) {

    ensureWalletConnected();

    const tx = await loanContract.approveLoan(loanIdHash);
    return tx.wait();

  }


  async function rejectLoanOnChain(loanIdHash, reason) {

    ensureWalletConnected();

    const tx = await loanContract.rejectLoan(loanIdHash, reason);
    return tx.wait();

  }


  async function depositFundsOnChain(loanIdHash, amountWei) {

    ensureWalletConnected();

    const tx = await loanContract.depositFunds(
      loanIdHash,
      { value: amountWei }
    );

    return tx.wait();

  }


  async function submitMilestoneProof(loanIdHash, milestoneIndex, proofHash) {

    ensureWalletConnected();

    const tx = await loanContract.submitMilestoneProof(
      loanIdHash,
      milestoneIndex,
      proofHash
    );

    return tx.wait();

  }


  async function makeRepaymentOnChain(loanIdHash, installment, amountWei) {

    ensureWalletConnected();

    const tx = await loanContract.makeRepayment(
      loanIdHash,
      installment,
      { value: amountWei }
    );

    return tx.wait();

  }


  // ─────────────────────────────────
  // Context Provider
  // ─────────────────────────────────

  return (

    <Web3Context.Provider value={{

      provider,
      signer,
      account,
      chainId,

      loanContract,
      kycContract,

      connected,
      loading,
      error,

      connectWallet,
      disconnect,

      applyLoanOnChain,
      approveLoanOnChain,
      rejectLoanOnChain,
      depositFundsOnChain,
      submitMilestoneProof,
      makeRepaymentOnChain

    }}>

      {children}

    </Web3Context.Provider>

  );

}

export const useWeb3 = () => useContext(Web3Context);