import { useState, useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useWeb3 } from "../context/Web3Context";

// â”€â”€ Shared styles â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const styles = {
  page: {
    minHeight: "100vh", background: "#060d1a", color: "#c8e0f4",
    backgroundImage: "linear-gradient(rgba(0,212,255,0.02) 1px,transparent 1px),linear-gradient(90deg,rgba(0,212,255,0.02) 1px,transparent 1px)",
    backgroundSize: "40px 40px"
  },
  card: {
    background: "#0c1829", border: "1px solid #1a3a5c", borderRadius: 12,
    padding: "32px", width: "100%", maxWidth: 420, margin: "40px auto",
    boxShadow: "0 0 40px rgba(0,212,255,0.06)"
  },
  title: {
    fontFamily: "sans-serif", fontWeight: 700, color: "#00d4ff",
    fontSize: 22, marginBottom: 20, letterSpacing: 1
  },
  form: { display: "flex", flexDirection: "column", gap: 14 },
  field: { display: "flex", flexDirection: "column", gap: 5 },
  label: { color: "#4a7090", fontSize: 12, fontFamily: "monospace", letterSpacing: 1 },
  input: {
    background: "#060d1a", border: "1px solid #1a3a5c", borderRadius: 6,
    color: "#c8e0f4", padding: "10px 14px", fontSize: 14, outline: "none",
    fontFamily: "inherit", width: "100%", boxSizing: "border-box"
  },
  btn: {
    background: "linear-gradient(135deg,#00d4ff,#0099cc)", border: "none",
    color: "#060d1a", fontWeight: 700, padding: "12px", borderRadius: 6,
    cursor: "pointer", fontSize: 15, fontFamily: "sans-serif", letterSpacing: 1
  },
  smallBtn: {
    background: "transparent", border: "1px solid #00d4ff", color: "#00d4ff",
    padding: "5px 12px", borderRadius: 4, cursor: "pointer", fontSize: 12, fontFamily: "monospace"
  },
  error: {
    background: "rgba(255,71,87,0.1)", border: "1px solid #ff4757",
    color: "#ff4757", padding: "10px 14px", borderRadius: 5, fontSize: 13
  },
  success: {
    background: "rgba(0,255,159,0.08)", border: "1px solid #00ff9f",
    color: "#00ff9f", padding: "14px", borderRadius: 6, fontSize: 14
  },
  infoBox: {
    background: "rgba(0,212,255,0.04)", border: "1px solid #1a3a5c",
    borderRadius: 6, padding: "12px 14px",
    fontSize: 13, color: "#4a7090", lineHeight: 1.7
  },
  loanCard: {
    background: "#0c1829", border: "1px solid #1a3a5c", borderRadius: 8,
    padding: "16px 20px", textDecoration: "none", display: "block",
    color: "inherit", marginBottom: 10, cursor: "pointer"
  },
  milestoneCard: {
    background: "#0c1829", border: "1px solid", borderRadius: 6, padding: "14px 16px"
  },
  empty: {
    background: "#0c1829", border: "1px solid #1a3a5c", borderRadius: 8,
    padding: 40, textAlign: "center", color: "#4a7090"
  },
  grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24 },
  infoItem: {
    background: "#0c1829", border: "1px solid #1a3a5c", borderRadius: 6,
    padding: "10px 14px", display: "flex", flexDirection: "column", gap: 4
  },
  sectionTitle: {
    fontFamily: "sans-serif", color: "#00d4ff", fontSize: 15,
    letterSpacing: 1, marginBottom: 12, marginTop: 28
  },
  statCard: { background: "#0c1829", border: "1px solid", borderRadius: 8, padding: "14px 16px" },
  walletRow: { display: "flex", alignItems: "center" },
  connectBtn: {
    background: "rgba(0,212,255,0.1)", border: "1px solid #00d4ff",
    color: "#00d4ff", padding: "8px 16px", borderRadius: 5, cursor: "pointer", fontSize: 13
  },
  wallet: { color: "#00ff9f", fontFamily: "monospace", fontSize: 13 },
  footer: { textAlign: "center", color: "#4a7090", fontSize: 13, marginTop: 16 }
};

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// REGISTER
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
export function Register() {
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "borrower", walletAddress: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const { account, connectWallet, connected } = useWeb3();
  const navigate = useNavigate();

  const handleConnect = async () => {
    await connectWallet();
    if (account) setForm(p => ({ ...p, walletAddress: account }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!account) return setError("Please connect your MetaMask wallet");
    setLoading(true); setError("");
    try {
      await register({ ...form, walletAddress: account });
      navigate("/kyc");
    } catch (err) {
      setError(err.response?.data?.message || "Registration failed");
    } finally { setLoading(false); }
  };

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const s = styles;

  return (
    <div style={s.page}>
      <div style={s.card}>
        <h2 style={s.title}>â›“ Create Account</h2>
        <form onSubmit={handleSubmit} style={s.form}>
          <input style={s.input} placeholder="Full Name" required value={form.name} onChange={e => f("name", e.target.value)} />
          <input style={s.input} placeholder="Email" type="email" required value={form.email} onChange={e => f("email", e.target.value)} />
          <input style={s.input} placeholder="Password" type="password" required value={form.password} onChange={e => f("password", e.target.value)} />
          <select style={s.input} value={form.role} onChange={e => f("role", e.target.value)}>
            <option value="borrower">MSME Borrower</option>
            <option value="lender">Lender</option>
            <option value="auditor">Auditor</option>
            <option value="government">Government</option>
          </select>
          <div style={s.walletRow}>
            {connected
              ? <span style={s.wallet}>ðŸ¦Š {account?.slice(0, 6)}...{account?.slice(-4)}</span>
              : <button type="button" onClick={handleConnect} style={s.connectBtn}>ðŸ¦Š Connect MetaMask</button>
            }
          </div>
          {error && <div style={s.error}>{error}</div>}
          <button type="submit" style={s.btn} disabled={loading}>
            {loading ? "Creating..." : "Create Account"}
          </button>
        </form>
        <p style={s.footer}>Already have an account? <Link to="/login" style={{ color: "#00d4ff" }}>Login</Link></p>
      </div>
    </div>
  );
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// KYC SUBMIT
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
export function KYCSubmit() {
  const [form, setForm] = useState({
    businessName: "", gstNumber: "", aadhaarNumber: "",
    panNumber: "", businessType: "", annualTurnover: ""
  });
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      const api = (await import("../utils/api")).default;
      const res = await api.post("/kyc/submit", form);
      setStatus({ msg: res.data.message, txHash: res.data.txHash });
    } catch (err) {
      setError(err.response?.data?.message || "Submission failed");
    } finally { setLoading(false); }
  };

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const s = styles;

  return (
    <div style={s.page}>
      <div style={{ ...s.card, maxWidth: 520 }}>
        <h2 style={s.title}>ðŸ“‹ KYC Verification</h2>
        <p style={{ color: "#4a7090", marginBottom: 20, fontSize: 13 }}>
          Your document hash will be stored on Ethereum. Sensitive data stays secure in our database.
        </p>
        {status
          ? <div style={s.success}>
            <p>âœ… {status.msg}</p>
            {status.txHash && <p style={{ fontSize: 12, fontFamily: "monospace", color: "#4a7090", marginTop: 8 }}>
              TxHash: {status.txHash}
            </p>}
          </div>
          : <form onSubmit={handleSubmit} style={s.form}>
            <input style={s.input} placeholder="Business Name" required value={form.businessName} onChange={e => f("businessName", e.target.value)} />
            <input style={s.input} placeholder="GST Number (e.g. 29ABCDE1234F1Z5)" required value={form.gstNumber} onChange={e => f("gstNumber", e.target.value)} />
            <input style={s.input} placeholder="Aadhaar Number" required value={form.aadhaarNumber} onChange={e => f("aadhaarNumber", e.target.value)} />
            <input style={s.input} placeholder="PAN Number" value={form.panNumber} onChange={e => f("panNumber", e.target.value)} />
            <select style={s.input} value={form.businessType} onChange={e => f("businessType", e.target.value)}>
              <option value="">Select Business Type</option>
              <option value="manufacturing">Manufacturing</option>
              <option value="services">Services</option>
              <option value="trading">Trading</option>
              <option value="retail">Retail</option>
            </select>
            <input style={s.input} placeholder="Annual Turnover (â‚¹)" type="number" value={form.annualTurnover} onChange={e => f("annualTurnover", e.target.value)} />
            {error && <div style={s.error}>{error}</div>}
            <button style={s.btn} type="submit" disabled={loading}>
              {loading ? "Submitting..." : "Submit KYC"}
            </button>
          </form>
        }
      </div>
    </div>
  );
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// APPLY LOAN
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
export function ApplyLoan() {
  const [form, setForm] = useState({ amountEth: "", tenureMonths: "12", collateral: "" });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { connected } = useWeb3();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!connected) return setError("Connect MetaMask first");
    setLoading(true); setError("");
    try {
      const { ethers } = await import("ethers");
      const api = (await import("../utils/api")).default;
      const amountWei = ethers.parseEther(form.amountEth).toString();
      const res = await api.post("/loans/apply", {
        amountWei, interestRate: 1200,
        tenureMonths: Number(form.tenureMonths),
        collateral: form.collateral
      });
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally { setLoading(false); }
  };

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const s = styles;

  return (
    <div style={s.page}>
      <div style={{ ...s.card, maxWidth: 520 }}>
        <h2 style={s.title}>ðŸ’° Apply for Loan</h2>
        {result
          ? <div style={result.status === "REJECTED" ? s.error : s.success}>
            <p><strong>Status:</strong> {result.status}</p>
            <p><strong>Credit Score:</strong> {result.creditScore}</p>
            {result.rejectReason && <p><strong>Reason:</strong> {result.rejectReason}</p>}
            {result.loanIdHash && <p style={{ fontSize: 11, fontFamily: "monospace", wordBreak: "break-all" }}>
              Loan ID: {result.loanIdHash}
            </p>}
            <Link to="/dashboard" style={{ color: "#00d4ff", display: "block", marginTop: 12 }}>â† Back to Dashboard</Link>
          </div>
          : <form onSubmit={handleSubmit} style={s.form}>
            <div style={s.field}>
              <label style={s.label}>LOAN AMOUNT (ETH)</label>
              <input style={s.input} type="number" step="0.001" required
                placeholder="e.g. 0.1" value={form.amountEth}
                onChange={e => f("amountEth", e.target.value)} />
            </div>
            <div style={s.field}>
              <label style={s.label}>TENURE (MONTHS)</label>
              <select style={s.input} value={form.tenureMonths} onChange={e => f("tenureMonths", e.target.value)}>
                {[6, 12, 18, 24, 36].map(m => <option key={m} value={m}>{m} months</option>)}
              </select>
            </div>
            <div style={s.field}>
              <label style={s.label}>COLLATERAL DESCRIPTION</label>
              <textarea style={{ ...s.input, height: 80, resize: "vertical" }}
                placeholder="Describe your collateral..."
                value={form.collateral} onChange={e => f("collateral", e.target.value)} />
            </div>
            <div style={s.infoBox}>
              <p>ðŸ“Š Auto credit evaluation based on KYC data</p>
              <p>ðŸ’Ž Milestone-based release: 20% â†’ 30% â†’ 30% â†’ 20%</p>
              <p>â›“ All transactions recorded on Ethereum</p>
            </div>
            {error && <div style={s.error}>{error}</div>}
            <button type="submit" style={s.btn} disabled={loading}>
              {loading ? "Applying..." : "Submit Loan Application"}
            </button>
          </form>
        }
      </div>
    </div>
  );
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// DASHBOARD
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
export function Dashboard() {
  const { user } = useAuth();
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLoans = async () => {
      try {
        const api = (await import("../utils/api")).default;
        const res = await api.get("/loans/my");
        setLoans(res.data.loans || []);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    fetchLoans();
  }, []);

  const statusColor = {
    PENDING: "#ffd32a", APPROVED: "#00d4ff", ACTIVE: "#00ff9f",
    COMPLETED: "#00ff9f", REJECTED: "#ff4757", DEFAULTED: "#ff4757"
  };

  const s = styles;

  return (
    <div style={s.page}>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "28px 16px" }}>
        <h1 style={{ ...s.title, textAlign: "left", marginBottom: 6 }}>
          Welcome, {user?.name} ðŸ‘‹
        </h1>
        <p style={{ color: "#4a7090", marginBottom: 28, fontFamily: "monospace", fontSize: 13 }}>
          Role: {user?.role?.toUpperCase()} Â· KYC: {user?.kyc_status?.toUpperCase()}
        </p>

        {user?.role === "borrower" && (
          <Link to="/loans/apply" style={{
            display: "inline-block", marginBottom: 20,
            background: "linear-gradient(135deg,#00d4ff,#0099cc)",
            color: "#060d1a", padding: "10px 20px", borderRadius: 6,
            textDecoration: "none", fontWeight: 700
          }}>+ Apply for Loan</Link>
        )}

        <h2 style={{ color: "#00d4ff", fontSize: 16, marginBottom: 14, letterSpacing: 1 }}>
          YOUR LOANS
        </h2>

        {loading ? <p style={{ color: "#4a7090" }}>Loading...</p>
          : loans.length === 0
            ? <div style={s.empty}>
              <p>No loans yet.</p>
              {user?.role === "borrower" && (
                <Link to="/loans/apply" style={{ color: "#00d4ff" }}>Apply for your first loan â†’</Link>
              )}
            </div>
            : <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {loans.map(loan => (
                <Link key={loan.id} to={`/loans/${loan.id}`} style={s.loanCard}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <p style={{ fontWeight: 700, color: "#c8e0f4", marginBottom: 4 }}>Loan #{loan.id}</p>
                      <p style={{ color: "#4a7090", fontSize: 13 }}>
                        Applied: {new Date(loan.applied_at).toLocaleDateString()}
                      </p>
                      <p style={{ color: "#4a7090", fontSize: 13 }}>Score: {loan.credit_score}</p>
                    </div>
                    <div style={{
                      background: `${statusColor[loan.status]}18`,
                      border: `1px solid ${statusColor[loan.status]}`,
                      color: statusColor[loan.status],
                      padding: "4px 14px", borderRadius: 4,
                      fontFamily: "monospace", fontSize: 13, fontWeight: 700
                    }}>
                      {loan.status}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
        }
      </div>
    </div>
  );
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// LOAN DETAIL
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
export function LoanDetail() {
  const { id } = useParams();
  const [loan, setLoan] = useState(null);
  const [loading, setLoading] = useState(true);
  const { makeRepaymentOnChain, connected } = useWeb3();
  const { user } = useAuth();

  useEffect(() => {
    const fetchLoan = async () => {
      const api = (await import("../utils/api")).default;
      const res = await api.get(`/loans/${id}`);
      setLoan(res.data.loan);
      setLoading(false);
    };
    fetchLoan();
  }, [id]);

  const handleSubmitProof = async (stage) => {
    const billDesc = prompt(`Describe Stage ${stage} bill/invoice:`);
    if (!billDesc) return;
    try {
      const api = (await import("../utils/api")).default;
      await api.post(`/milestones/${id}/submit`, { stage, billDescription: billDesc, proofData: billDesc });
      alert("Proof submitted! Awaiting verification.");
      window.location.reload();
    } catch (err) { alert(err.response?.data?.message || err.message); }
  };

  const handleRepay = async (installment, amountWei) => {
    if (!connected) return alert("Connect MetaMask first");
    try {
      const receipt = await makeRepaymentOnChain(loan.loan_id_hash, installment, amountWei);
      const api = (await import("../utils/api")).default;
      await api.post(`/repayments/${id}/record`, {
        installmentNo: installment, txHash: receipt.hash, amountPaidWei: amountWei
      });
      alert("âœ… Repayment successful!");
      window.location.reload();
    } catch (err) { alert(err.message); }
  };

  const s = styles;
  const MILESTONE_LABELS = [
    "Stage 1 (20%) â€” Auto on Approval",
    "Stage 2 (30%) â€” Bill 1",
    "Stage 3 (30%) â€” Bill 2",
    "Stage 4 (20%) â€” Final Proof"
  ];

  if (loading) return <div style={s.page}><p style={{ color: "#4a7090", padding: 40 }}>Loading...</p></div>;
  if (!loan) return <div style={s.page}><p style={{ color: "#ff4757", padding: 40 }}>Loan not found.</p></div>;

  return (
    <div style={s.page}>
      <div style={{ maxWidth: 860, margin: "0 auto", padding: "28px 16px" }}>
        <Link to="/dashboard" style={{ color: "#4a7090", fontSize: 13, textDecoration: "none" }}>â† Back</Link>
        <h1 style={{ ...s.title, textAlign: "left", marginTop: 12 }}>Loan #{loan.id}</h1>

        <div style={s.grid2}>
          {[
            ["Status", loan.status],
            ["Credit Score", loan.credit_score],
            ["Tenure", `${loan.tenure_months} months`],
            ["Borrower", loan.borrower_name],
            ["Lender", loan.lender_name || "â€”"],
            ["Applied", new Date(loan.applied_at).toLocaleDateString()]
          ].map(([k, v]) => (
            <div key={k} style={s.infoItem}>
              <span style={{ color: "#4a7090", fontSize: 12, fontFamily: "monospace" }}>{k}</span>
              <span style={{ color: "#c8e0f4", fontWeight: 600 }}>{v}</span>
            </div>
          ))}
        </div>

        <h2 style={s.sectionTitle}>ðŸŽ¯ Milestones</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {(loan.milestones || []).map((m, i) => (
            <div key={i} style={{
              ...s.milestoneCard,
              borderColor: m.status === "RELEASED" ? "#00ff9f" : m.status === "SUBMITTED" ? "#ffd32a" : "#1a3a5c"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <p style={{ color: "#c8e0f4", fontWeight: 600, fontSize: 14 }}>{MILESTONE_LABELS[i]}</p>
                  {m.bill_description && <p style={{ color: "#4a7090", fontSize: 12 }}>{m.bill_description}</p>}
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{
                    color: m.status === "RELEASED" ? "#00ff9f" : m.status === "SUBMITTED" ? "#ffd32a" : "#4a7090",
                    fontFamily: "monospace", fontSize: 12, border: "1px solid", borderColor: "currentColor",
                    padding: "2px 8px", borderRadius: 3
                  }}>{m.status}</span>
                  {user?.role === "borrower" && m.status === "PENDING" && i > 0 && loan.status === "ACTIVE" && (
                    <button onClick={() => handleSubmitProof(m.stage)} style={s.smallBtn}>Submit Proof</button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {loan.repayments?.length > 0 && <>
          <h2 style={s.sectionTitle}>ðŸ’³ Repayment Schedule</h2>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr>{["#", "Due Date", "Status", "Action"].map(h => (
                <th key={h} style={{ color: "#4a7090", textAlign: "left", padding: "8px 12px", borderBottom: "1px solid #1a3a5c", fontSize: 12 }}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {loan.repayments.map((r, i) => (
                <tr key={i} style={{ borderBottom: "1px solid rgba(26,58,92,0.4)" }}>
                  <td style={{ padding: "8px 12px", color: "#c8e0f4" }}>{r.installment_no}</td>
                  <td style={{ padding: "8px 12px", color: "#c8e0f4" }}>{new Date(r.due_date).toLocaleDateString()}</td>
                  <td style={{ padding: "8px 12px" }}>
                    <span style={{ color: r.paid ? "#00ff9f" : "#ffd32a" }}>{r.paid ? "PAID" : "PENDING"}</span>
                  </td>
                  <td style={{ padding: "8px 12px" }}>
                    {!r.paid && user?.role === "borrower" && loan.status === "ACTIVE" && (
                      <button onClick={() => handleRepay(r.installment_no, r.emi_amount_wei)} style={s.smallBtn}>Pay EMI</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>}
      </div>
    </div>
  );
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// LENDER REVIEW
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
export function LenderReview() {
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);
  const { approveLoanOnChain, rejectLoanOnChain, depositFundsOnChain, connected } = useWeb3();

  useEffect(() => {
    const fetchLoans = async () => {
      const api = (await import("../utils/api")).default;
      const res = await api.get("/loans/pending");
      setLoans(res.data.loans || []);
      setLoading(false);
    };
    fetchLoans();
  }, []);

  const handleApprove = async (loan) => {
    if (!connected) return alert("Connect MetaMask first");
    try {
      const receipt = await approveLoanOnChain(loan.loan_id_hash);
      const api = (await import("../utils/api")).default;
      await api.post(`/loans/${loan.id}/approve`, { txHash: receipt.hash });
      const shouldDeposit = window.confirm("Loan approved! Deposit funds now? (Releases 20% to borrower)");
      if (shouldDeposit) {
        await depositFundsOnChain(loan.loan_id_hash, loan.amount_wei);
      }
      alert("âœ… Done!");
      window.location.reload();
    } catch (err) { alert(err.message); }
  };

  const handleReject = async (loan) => {
    const reason = prompt("Reason for rejection:");
    if (!reason) return;
    try {
      const receipt = await rejectLoanOnChain(loan.loan_id_hash, reason);
      const api = (await import("../utils/api")).default;
      await api.post(`/loans/${loan.id}/reject`, { reason, txHash: receipt.hash });
      alert("Loan rejected.");
      window.location.reload();
    } catch (err) { alert(err.message); }
  };

  const s = styles;

  return (
    <div style={s.page}>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "28px 16px" }}>
        <h1 style={{ ...s.title, textAlign: "left" }}>ðŸ¦ Pending Loan Requests</h1>
        {loading ? <p style={{ color: "#4a7090" }}>Loading...</p>
          : loans.length === 0
            ? <div style={s.empty}><p>No pending loan requests.</p></div>
            : loans.map(loan => (
              <div key={loan.id} style={s.loanCard}>
                <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
                  <div>
                    <p style={{ color: "#00d4ff", fontWeight: 700, fontSize: 16 }}>
                      {loan.business_name || loan.borrower_name}
                    </p>
                    <p style={{ color: "#4a7090", fontSize: 13, marginTop: 4 }}>
                      Score: <strong style={{ color: "#00ff9f" }}>{loan.credit_score}</strong>
                      Â· Tenure: {loan.tenure_months} months
                    </p>
                    <p style={{ color: "#4a7090", fontSize: 13 }}>
                      Turnover: â‚¹{Number(loan.annual_turnover || 0).toLocaleString()}
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={() => handleApprove(loan)} style={{ ...s.btn, background: "linear-gradient(135deg,#00ff9f,#00cc7a)", padding: "8px 20px", fontSize: 14 }}>
                      âœ… Approve
                    </button>
                    <button onClick={() => handleReject(loan)} style={{ ...s.btn, background: "linear-gradient(135deg,#ff4757,#cc0018)", padding: "8px 20px", fontSize: 14 }}>
                      âŒ Reject
                    </button>
                  </div>
                </div>
              </div>
            ))
        }
      </div>
    </div>
  );
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// ADMIN PANEL
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
export function AdminPanel() {
  const [data, setData] = useState(null);
  const [pending, setPending] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      const api = (await import("../utils/api")).default;
      const [dash, kyc] = await Promise.all([
        api.get("/admin/dashboard"),
        api.get("/kyc/pending")
      ]);
      setData(dash.data);
      setPending(kyc.data.pending || []);
    };
    fetchData();
  }, []);

  const handleKYC = async (userId, status) => {
    const api = (await import("../utils/api")).default;
    await api.post(`/kyc/verify/${userId}`, { status });
    alert(`KYC ${status}`);
    window.location.reload();
  };

  const s = styles;
  const stats = data?.stats || {};

  return (
    <div style={s.page}>
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "28px 16px" }}>
        <h1 style={{ ...s.title, textAlign: "left" }}>âš™ Admin Panel</h1>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 12, marginBottom: 28 }}>
          {[
            ["Total Loans", stats.total_loans, "#00d4ff"],
            ["Pending", stats.pending, "#ffd32a"],
            ["Active", stats.active, "#00ff9f"],
            ["Completed", stats.completed, "#00ff9f"],
            ["Rejected", stats.rejected, "#ff4757"],
            ["Defaulted", stats.defaulted, "#ff4757"]
          ].map(([label, val, color]) => (
            <div key={label} style={{ ...s.statCard, borderColor: color }}>
              <p style={{ color: "#4a7090", fontSize: 12, fontFamily: "monospace" }}>{label}</p>
              <p style={{ color, fontSize: 28, fontWeight: 700 }}>{val || 0}</p>
            </div>
          ))}
        </div>

        <h2 style={s.sectionTitle}>ðŸ“‹ Pending KYC ({pending.length})</h2>
        {pending.length === 0
          ? <div style={s.empty}><p>No pending KYC requests.</p></div>
          : pending.map(u => (
            <div key={u.id} style={s.loanCard}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <p style={{ color: "#c8e0f4", fontWeight: 600 }}>{u.name} â€” {u.business_name}</p>
                  <p style={{ color: "#4a7090", fontSize: 13 }}>GST: {u.gst_number} Â· Role: {u.role}</p>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => handleKYC(u.id, "verified")} style={{ ...s.smallBtn, borderColor: "#00ff9f", color: "#00ff9f" }}>Verify âœ…</button>
                  <button onClick={() => handleKYC(u.id, "rejected")} style={{ ...s.smallBtn, borderColor: "#ff4757", color: "#ff4757" }}>Reject âŒ</button>
                </div>
              </div>
            </div>
          ))
        }
      </div>
    </div>
  );
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// AUDIT LOGS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
export function AuditLogs() {
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    const fetchLogs = async () => {
      const api = (await import("../utils/api")).default;
      const res = await api.get("/admin/audit-logs");
      setLogs(res.data.logs || []);
    };
    fetchLogs();
  }, []);

  const actionColors = {
    KYC_SUBMITTED: "#00d4ff", KYC_VERIFIED: "#00ff9f",
    LOAN_APPLIED: "#ffd32a", LOAN_APPROVED: "#00ff9f",
    LOAN_REJECTED: "#ff4757", MILESTONE_RELEASED: "#a78bfa",
    REPAYMENT_MADE: "#00ff9f", LOAN_DEFAULTED: "#ff4757"
  };

  const s = styles;

  return (
    <div style={s.page}>
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "28px 16px" }}>
        <h1 style={{ ...s.title, textAlign: "left" }}>ðŸ“‘ Audit Logs â€” Blockchain Trail</h1>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr>{["Time", "Action", "Actor", "Loan", "Tx Hash"].map(h => (
              <th key={h} style={{ color: "#4a7090", textAlign: "left", padding: "10px 12px", borderBottom: "1px solid #1a3a5c", fontSize: 11 }}>{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {logs.map(log => (
              <tr key={log.id} style={{ borderBottom: "1px solid rgba(26,58,92,0.3)" }}>
                <td style={{ padding: "8px 12px", color: "#4a7090", whiteSpace: "nowrap" }}>
                  {new Date(log.created_at).toLocaleString()}
                </td>
                <td style={{ padding: "8px 12px" }}>
                  <span style={{
                    color: actionColors[log.action] || "#c8e0f4",
                    fontFamily: "monospace", fontSize: 11,
                    border: "1px solid currentColor", padding: "2px 6px", borderRadius: 3
                  }}>{log.action}</span>
                </td>
                <td style={{ padding: "8px 12px", color: "#4a7090", fontFamily: "monospace", fontSize: 11 }}>
                  {log.actor_wallet ? `${log.actor_wallet.slice(0, 10)}...` : "â€”"}
                </td>
                <td style={{ padding: "8px 12px", color: "#c8e0f4" }}>{log.loan_id || "â€”"}</td>
                <td style={{ padding: "8px 12px", color: "#4a7090", fontFamily: "monospace", fontSize: 11 }}>
                  {log.tx_hash ? `${log.tx_hash.slice(0, 14)}...` : "â€”"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {logs.length === 0 && <div style={s.empty}><p>No audit logs yet.</p></div>}
      </div>
    </div>
  );
}

