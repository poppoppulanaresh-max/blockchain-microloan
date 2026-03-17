// frontend2/src/pages/LoanApplication.jsx
import React, { useState } from "react";
import { useWeb3 } from "../context/Web3Context";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { ethers } from "ethers";

const PURPOSES = [
  "Working Capital",
  "Equipment Purchase",
  "Inventory",
  "Business Expansion",
  "Technology Upgrade",
  "Other",
];

const initialForm = {
  amount: "",
  interestRate: "",   // replaces broken "pct" field
  tenureMonths: "",
  purpose: "",
  collateral: "",
  businessName: "",
  description: "",
};

export default function LoanApplication() {
  const { connected, account, connectWallet, applyLoanOnChain, loading: web3Loading } = useWeb3();
  const { user, token } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [txHash, setTxHash] = useState(null);
  const [error, setError] = useState(null);
  const [step, setStep] = useState(1); // 1 = form, 2 = confirm, 3 = done

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const validate = () => {
    if (!form.amount || isNaN(form.amount) || Number(form.amount) <= 0)
      return "Enter a valid loan amount.";
    if (!form.interestRate || isNaN(form.interestRate) || Number(form.interestRate) <= 0 || Number(form.interestRate) > 100)
      return "Interest rate must be between 1 and 100.";
    if (!form.tenureMonths || isNaN(form.tenureMonths) || Number(form.tenureMonths) < 1)
      return "Tenure must be at least 1 month.";
    if (!form.purpose) return "Select a purpose.";
    if (!form.businessName.trim()) return "Enter your business name.";
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const validationError = validate();
    if (validationError) { setError(validationError); return; }

    // Ensure wallet is connected — connectWallet() is idempotent (won't re-prompt if already connected)
    if (!connected || !account) {
      try {
        await connectWallet();
        // Note: connected/account are React state — they update asynchronously.
        // We don't re-check here; the form submit will show the wallet banner
        // and the user must click again. The banner in the UI makes this clear.
        setError("Wallet connected! Please click 'Review Application' again to continue.");
        return;
      } catch {
        setError("Please connect your MetaMask wallet to continue.");
        return;
      }
    }

    setStep(2);
  };

  const handleConfirm = async () => {
    setSubmitting(true);
    setError(null);

    try {
      // ── 1. Submit to blockchain ──────────────────────────────────────────────
      // Convert amount (in ETH / tokens) to Wei
      const amountWei = ethers.parseEther(String(form.amount));

      // interestRate and tenureMonths as plain integers — fixes PCT field error
      const interestRate  = parseInt(form.interestRate, 10);
      const tenureMonths  = parseInt(form.tenureMonths, 10);
      const collateral    = form.collateral.trim() || "none";

      const receipt = await applyLoanOnChain(
        amountWei,
        interestRate,
        tenureMonths,
        collateral
      );

      setTxHash(receipt.hash || receipt.transactionHash);

      // ── 2. Persist to backend ────────────────────────────────────────────────
      await axios.post(
        "/api/loans/apply",
        {
          amountEth:    Number(form.amount),   // human-readable reference
          interestRate: interestRate,        // consistent field name — no "pct"
          tenureMonths: tenureMonths,
          purpose:      form.purpose,
          collateral:   collateral,
          businessName: form.businessName,
          description:  form.description,
          walletAddress: account,
          txHash:        receipt.hash || receipt.transactionHash,
          amountWei:     amountWei.toString(), // ensure string for DB
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setStep(3);
    } catch (err) {
      console.error("Loan application error:", err);
      // Surface readable error to the user
      const msg =
        err?.reason ||
        err?.data?.message ||
        err?.message ||
        "Transaction failed. Please try again.";
      setError(msg);
      setStep(1);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Step 3: Success ──────────────────────────────────────────────────────────
  if (step === 3) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={styles.successIcon}>✅</div>
          <h2 style={styles.successTitle}>Loan Application Submitted!</h2>
          <p style={styles.successSub}>Your application has been recorded on-chain and sent for review.</p>
          {txHash && (
            <a
              href={`https://sepolia.etherscan.io/tx/${txHash}`}
              target="_blank"
              rel="noreferrer"
              style={styles.txLink}
            >
              View Transaction ↗
            </a>
          )}
          <button style={styles.primaryBtn} onClick={() => navigate("/dashboard")}>
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // ── Step 2: Confirm ──────────────────────────────────────────────────────────
  if (step === 2) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Confirm Loan Application</h2>
          <p style={styles.confirmNote}>
            This will submit a transaction to the Ethereum Sepolia network via MetaMask.
          </p>
          <div style={styles.summaryBox}>
            {[
              ["Business",      form.businessName],
              ["Amount",        `${form.amount} ETH`],
              ["Interest Rate", `${form.interestRate}%`],
              ["Tenure",        `${form.tenureMonths} months`],
              ["Purpose",       form.purpose],
              ["Collateral",    form.collateral || "None"],
            ].map(([label, value]) => (
              <div key={label} style={styles.summaryRow}>
                <span style={styles.summaryLabel}>{label}</span>
                <span style={styles.summaryValue}>{value}</span>
              </div>
            ))}
          </div>
          {error && <div style={styles.errorBox}>{error}</div>}
          <div style={styles.btnRow}>
            <button style={styles.secondaryBtn} onClick={() => setStep(1)} disabled={submitting}>
              Back
            </button>
            <button style={styles.primaryBtn} onClick={handleConfirm} disabled={submitting}>
              {submitting ? "Submitting…" : "Confirm & Submit"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Step 1: Form ─────────────────────────────────────────────────────────────
  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h2 style={styles.cardTitle}>Apply for a Microloan</h2>

        {/* Wallet status banner */}
        {!connected ? (
          <div style={styles.walletWarning}>
            <span>🦊 MetaMask not connected.</span>
            <button style={styles.connectBtn} onClick={connectWallet} disabled={web3Loading}>
              {web3Loading ? "Connecting…" : "Connect Wallet"}
            </button>
          </div>
        ) : (
          <div style={styles.walletConnected}>
            🟢 Wallet connected: <span style={styles.addr}>{account?.slice(0,6)}…{account?.slice(-4)}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.row}>
            <Field label="Business Name" name="businessName" value={form.businessName}
              onChange={handleChange} placeholder="Your MSME name" required />
            <Field label="Loan Amount (ETH)" name="amount" value={form.amount}
              onChange={handleChange} type="number" min="0.001" step="any"
              placeholder="e.g. 0.5" required />
          </div>

          <div style={styles.row}>
            {/* "interestRate" replaces the broken "pct" field name */}
            <Field label="Interest Rate (%)" name="interestRate" value={form.interestRate}
              onChange={handleChange} type="number" min="1" max="100" step="0.1"
              placeholder="e.g. 10" required />
            <Field label="Tenure (Months)" name="tenureMonths" value={form.tenureMonths}
              onChange={handleChange} type="number" min="1" max="360"
              placeholder="e.g. 12" required />
          </div>

          <div style={styles.fieldGroup}>
            <label style={styles.label}>Purpose *</label>
            <select name="purpose" value={form.purpose} onChange={handleChange}
              style={styles.select} required>
              <option value="">Select purpose…</option>
              {PURPOSES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          <Field label="Collateral (optional)" name="collateral" value={form.collateral}
            onChange={handleChange} placeholder="e.g. Land deed, machinery" />

          <div style={styles.fieldGroup}>
            <label style={styles.label}>Description (optional)</label>
            <textarea name="description" value={form.description} onChange={handleChange}
              rows={3} style={styles.textarea}
              placeholder="Brief description of how you'll use the loan…" />
          </div>

          {error && <div style={styles.errorBox}>{error}</div>}

          <button type="submit" style={styles.primaryBtn}>
            Review Application →
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Reusable field ──────────────────────────────────────────────────────────────
function Field({ label, name, value, onChange, type = "text", required, ...rest }) {
  return (
    <div style={styles.fieldGroup}>
      <label style={styles.label}>{label}{required && " *"}</label>
      <input
        name={name} value={value} onChange={onChange}
        type={type} style={styles.input} required={required} {...rest}
      />
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────────
const styles = {
  page:      { minHeight: "100vh", background: "#070f1a", display: "flex", justifyContent: "center", alignItems: "flex-start", padding: "40px 16px" },
  card:      { background: "#0c1829", border: "1px solid #1a3a5c", borderRadius: 12, padding: "32px 36px", width: "100%", maxWidth: 680 },
  cardTitle: { color: "#00d4ff", fontFamily: "Rajdhani,sans-serif", fontSize: 22, fontWeight: 700, marginBottom: 20 },
  form:      { display: "flex", flexDirection: "column", gap: 18 },
  row:       { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 },
  fieldGroup:{ display: "flex", flexDirection: "column", gap: 6 },
  label:     { color: "#8ab4cc", fontSize: 13, fontWeight: 600 },
  input:     { background: "#0a1525", border: "1px solid #1a3a5c", borderRadius: 6, color: "#c8e0f4", padding: "10px 12px", fontSize: 14, outline: "none" },
  select:    { background: "#0a1525", border: "1px solid #1a3a5c", borderRadius: 6, color: "#c8e0f4", padding: "10px 12px", fontSize: 14 },
  textarea:  { background: "#0a1525", border: "1px solid #1a3a5c", borderRadius: 6, color: "#c8e0f4", padding: "10px 12px", fontSize: 14, resize: "vertical" },
  primaryBtn:{ background: "linear-gradient(135deg,#00d4ff,#0099cc)", color: "#000", border: "none", borderRadius: 7, padding: "12px 28px", fontSize: 15, fontWeight: 700, cursor: "pointer", marginTop: 4 },
  secondaryBtn:{ background: "transparent", border: "1px solid #1a3a5c", color: "#8ab4cc", borderRadius: 7, padding: "12px 28px", fontSize: 15, cursor: "pointer" },
  connectBtn:{ background: "rgba(0,212,255,0.12)", border: "1px solid #00d4ff", color: "#00d4ff", borderRadius: 5, padding: "6px 14px", cursor: "pointer", fontSize: 13 },
  walletWarning: { background: "rgba(255,165,0,0.08)", border: "1px solid #ff9800", borderRadius: 7, padding: "10px 16px", color: "#ffb74d", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  walletConnected:{ background: "rgba(0,255,159,0.07)", border: "1px solid #00ff9f", borderRadius: 7, padding: "10px 16px", color: "#00ff9f", fontSize: 13, marginBottom: 4 },
  addr:      { fontFamily: "monospace" },
  errorBox:  { background: "rgba(255,71,87,0.1)", border: "1px solid #ff4757", color: "#ff6b81", borderRadius: 6, padding: "10px 14px", fontSize: 13 },
  summaryBox:{ background: "#070f1a", border: "1px solid #1a3a5c", borderRadius: 8, padding: "16px 20px", display: "flex", flexDirection: "column", gap: 10, margin: "16px 0" },
  summaryRow:{ display: "flex", justifyContent: "space-between" },
  summaryLabel:{ color: "#8ab4cc", fontSize: 13 },
  summaryValue:{ color: "#c8e0f4", fontSize: 13, fontWeight: 600 },
  confirmNote:{ color: "#4a7090", fontSize: 13, marginBottom: 4 },
  btnRow:    { display: "flex", gap: 12, marginTop: 8 },
  successIcon:{ fontSize: 48, textAlign: "center", marginBottom: 12 },
  successTitle:{ color: "#00ff9f", textAlign: "center", fontSize: 22, fontWeight: 700 },
  successSub:{ color: "#8ab4cc", textAlign: "center", fontSize: 14, marginBottom: 16 },
  txLink:    { display: "block", textAlign: "center", color: "#00d4ff", fontSize: 13, marginBottom: 20 },
};
