import { useState, useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useWeb3 } from "../context/Web3Context";

/* ─── Shared Styles ──────────────────────────────────────────────── */
const styles = {
  page: {
    minHeight: "100vh",
    background: "#060d1a",
    color: "#c8e0f4",
    backgroundImage:
      "linear-gradient(rgba(0,212,255,0.02) 1px,transparent 1px),linear-gradient(90deg,rgba(0,212,255,0.02) 1px,transparent 1px)",
    backgroundSize: "40px 40px",
    fontFamily: "'Segoe UI', sans-serif",
  },
  navbar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 32px",
    borderBottom: "1px solid #1a3a5c",
    background: "rgba(6,13,26,0.95)",
    position: "sticky",
    top: 0,
    zIndex: 100,
    backdropFilter: "blur(10px)",
  },
  navLogo: { color: "#00d4ff", fontWeight: 800, fontSize: 18, letterSpacing: 2, textDecoration: "none" },
  navLinks: { display: "flex", gap: 20, alignItems: "center" },
  navLink: { color: "#4a7090", textDecoration: "none", fontSize: 13, fontFamily: "monospace", letterSpacing: 1 },
  card: {
    background: "#0c1829", border: "1px solid #1a3a5c", borderRadius: 12,
    padding: "32px", width: "100%", maxWidth: 440, margin: "40px auto",
    boxShadow: "0 0 60px rgba(0,212,255,0.05)",
  },
  title: { fontWeight: 700, color: "#00d4ff", fontSize: 22, marginBottom: 6, letterSpacing: 1 },
  subtitle: { color: "#4a7090", fontSize: 13, marginBottom: 24, fontFamily: "monospace" },
  form: { display: "flex", flexDirection: "column", gap: 14 },
  field: { display: "flex", flexDirection: "column", gap: 5 },
  label: { color: "#4a7090", fontSize: 11, fontFamily: "monospace", letterSpacing: 2, textTransform: "uppercase" },
  input: {
    background: "#060d1a", border: "1px solid #1a3a5c", borderRadius: 6,
    color: "#c8e0f4", padding: "11px 14px", fontSize: 14, outline: "none",
    fontFamily: "inherit", width: "100%", boxSizing: "border-box",
  },
  btn: {
    background: "linear-gradient(135deg,#00d4ff,#0099cc)", border: "none",
    color: "#060d1a", fontWeight: 700, padding: "12px", borderRadius: 6,
    cursor: "pointer", fontSize: 14, letterSpacing: 1,
  },
  btnOutline: {
    background: "transparent", border: "1px solid #00d4ff", color: "#00d4ff",
    fontWeight: 700, padding: "10px 18px", borderRadius: 6, cursor: "pointer", fontSize: 13,
  },
  smallBtn: {
    background: "transparent", border: "1px solid #00d4ff", color: "#00d4ff",
    padding: "5px 12px", borderRadius: 4, cursor: "pointer", fontSize: 12, fontFamily: "monospace",
  },
  error: {
    background: "rgba(255,71,87,0.1)", border: "1px solid #ff4757",
    color: "#ff4757", padding: "10px 14px", borderRadius: 5, fontSize: 13,
  },
  success: {
    background: "rgba(0,255,159,0.08)", border: "1px solid #00ff9f",
    color: "#00ff9f", padding: "14px", borderRadius: 6, fontSize: 14,
  },
  warning: {
    background: "rgba(255,211,42,0.08)", border: "1px solid #ffd32a",
    color: "#ffd32a", padding: "10px 14px", borderRadius: 5, fontSize: 13,
  },
  infoBox: {
    background: "rgba(0,212,255,0.04)", border: "1px solid #1a3a5c",
    borderRadius: 6, padding: "12px 14px", fontSize: 13, color: "#4a7090", lineHeight: 1.7,
  },
  loanCard: {
    background: "#0c1829", border: "1px solid #1a3a5c", borderRadius: 8,
    padding: "16px 20px", textDecoration: "none", display: "block",
    color: "inherit", marginBottom: 10, cursor: "pointer",
  },
  milestoneCard: { background: "#0c1829", border: "1px solid", borderRadius: 6, padding: "14px 16px" },
  empty: { background: "#0c1829", border: "1px solid #1a3a5c", borderRadius: 8, padding: 40, textAlign: "center", color: "#4a7090" },
  grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24 },
  grid3: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 28 },
  infoItem: {
    background: "#0c1829", border: "1px solid #1a3a5c", borderRadius: 6,
    padding: "10px 14px", display: "flex", flexDirection: "column", gap: 4,
  },
  sectionTitle: {
    color: "#00d4ff", fontSize: 13, letterSpacing: 2, marginBottom: 12, marginTop: 28,
    textTransform: "uppercase", fontFamily: "monospace",
  },
  statCard: { background: "#0c1829", border: "1px solid", borderRadius: 8, padding: "14px 16px" },
  connectBtn: {
    background: "rgba(0,212,255,0.1)", border: "1px solid #00d4ff", color: "#00d4ff",
    padding: "8px 16px", borderRadius: 5, cursor: "pointer", fontSize: 13, fontFamily: "monospace",
  },
  wallet: {
    color: "#00ff9f", fontFamily: "monospace", fontSize: 13,
    background: "rgba(0,255,159,0.06)", border: "1px solid rgba(0,255,159,0.2)",
    padding: "6px 12px", borderRadius: 5,
  },
  footer: { textAlign: "center", color: "#4a7090", fontSize: 13, marginTop: 20 },
  badge: {
    display: "inline-block", padding: "3px 10px", borderRadius: 4,
    fontFamily: "monospace", fontSize: 11, fontWeight: 700, border: "1px solid",
  },
  progressBar: { width: "100%", height: 6, background: "#1a3a5c", borderRadius: 3, overflow: "hidden", marginTop: 6 },
  tag: {
    display: "inline-block", background: "rgba(0,212,255,0.08)", border: "1px solid #1a3a5c",
    color: "#4a7090", padding: "2px 8px", borderRadius: 3, fontSize: 11, fontFamily: "monospace",
  },
  divider: { border: "none", borderTop: "1px solid #1a3a5c", margin: "20px 0" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  th: { color: "#4a7090", textAlign: "left", padding: "10px 14px", fontSize: 11, fontFamily: "monospace", letterSpacing: 1, borderBottom: "1px solid #1a3a5c" },
  td: { padding: "10px 14px", borderBottom: "1px solid rgba(26,58,92,0.3)", color: "#c8e0f4" },
};

/* ─── Utility Components ─────────────────────────────────────────── */
function Navbar({ user, onLogout }) {
  const s = styles;
  const roleColors = {
    borrower: "#00d4ff",
    lender: "#00ff9f",
    auditor: "#a78bfa",
    government: "#ffd32a",
  };
  const roleColor = roleColors[user?.role] || "#00d4ff";

  return (
    <nav style={s.navbar}>
      <Link to="/dashboard" style={{ ...s.navLogo, color: roleColor }}>
        ⛓ MICROLOAN
      </Link>
      <div style={s.navLinks}>
        {user?.role === "borrower" && (
          <>
            <Link to="/dashboard" style={s.navLink}>Dashboard</Link>
            <Link to="/loans/apply" style={s.navLink}>Apply Loan</Link>
            <Link to="/kyc" style={s.navLink}>KYC</Link>
          </>
        )}
        {user?.role === "lender" && (
          <>
            <Link to="/dashboard" style={s.navLink}>Dashboard</Link>
            <Link to="/lender" style={s.navLink}>Review Loans</Link>
          </>
        )}
        {user?.role === "auditor" && (
          <>
            <Link to="/dashboard" style={s.navLink}>Dashboard</Link>
            <Link to="/admin" style={s.navLink}>KYC Verify</Link>
            <Link to="/audit" style={s.navLink}>Audit Logs</Link>
          </>
        )}
        {user?.role === "government" && (
          <>
            <Link to="/dashboard" style={s.navLink}>Dashboard</Link>
            <Link to="/admin" style={s.navLink}>Admin Panel</Link>
            <Link to="/audit" style={s.navLink}>Audit Logs</Link>
          </>
        )}
        {user && (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ ...s.tag, color: roleColor, borderColor: roleColor, fontSize: 10 }}>
              {user.role?.toUpperCase()}
            </span>
            <button onClick={onLogout} style={{ ...s.smallBtn, borderColor: "#ff4757", color: "#ff4757" }}>
              Logout
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}

function StatusBadge({ status }) {
  const colors = {
    PENDING: "#ffd32a", APPROVED: "#00d4ff", ACTIVE: "#00ff9f",
    COMPLETED: "#00ff9f", REJECTED: "#ff4757", DEFAULTED: "#ff4757",
    VERIFIED: "#00ff9f", SUBMITTED: "#ffd32a", RELEASED: "#00ff9f", PAID: "#00ff9f",
  };
  const c = colors[status] || "#4a7090";
  return (
    <span style={{ ...styles.badge, color: c, borderColor: c, background: `${c}18` }}>
      {status}
    </span>
  );
}

function StatCard({ label, value, color, sub, icon }) {
  return (
    <div style={{ ...styles.statCard, borderColor: color || "#1a3a5c" }}>
      <p style={{ color: "#4a7090", fontSize: 11, fontFamily: "monospace", letterSpacing: 1, marginBottom: 6 }}>
        {icon} {label}
      </p>
      <p style={{ color: color || "#c8e0f4", fontSize: 26, fontWeight: 700, margin: 0 }}>
        {value ?? 0}
      </p>
      {sub && <p style={{ color: "#4a7090", fontSize: 11, marginTop: 4 }}>{sub}</p>}
    </div>
  );
}

function MilestoneProgress({ milestones = [] }) {
  const weights = [20, 30, 30, 20];
  const releasedPct = milestones.reduce(
    (acc, m, i) => acc + (m.status === "RELEASED" ? (weights[i] || 0) : 0), 0
  );
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ color: "#4a7090", fontSize: 12, fontFamily: "monospace" }}>FUNDS RELEASED</span>
        <span style={{ color: "#00ff9f", fontSize: 12, fontFamily: "monospace" }}>{releasedPct}%</span>
      </div>
      <div style={styles.progressBar}>
        <div style={{ width: `${releasedPct}%`, height: "100%", background: "linear-gradient(90deg,#00d4ff,#00ff9f)", borderRadius: 3 }} />
      </div>
      <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
        {milestones.map((m, i) => (
          <div key={i} style={{
            flex: 1, height: 4, borderRadius: 2,
            background: m.status === "RELEASED" ? "#00ff9f" : m.status === "SUBMITTED" ? "#ffd32a" : "#1a3a5c",
          }} />
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   REGISTER
═══════════════════════════════════════════════════════════════════ */
export function Register() {
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "borrower", walletAddress: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const { account, connectWallet, connected } = useWeb3();
  const navigate = useNavigate();

  const handleConnect = async () => {
    await connectWallet();
    if (account) setForm((p) => ({ ...p, walletAddress: account }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!account) return setError("Please connect your MetaMask wallet first");
    setLoading(true);
    setError("");
    try {
      await register({ ...form, walletAddress: account });
      navigate("/kyc");
    } catch (err) {
      setError(err.response?.data?.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const f = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const s = styles;

  return (
    <div style={s.page}>
      <div style={{ ...s.card, maxWidth: 460 }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(0,212,255,0.1)", border: "1px solid #00d4ff", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px", fontSize: 22 }}>⛓</div>
          <h2 style={s.title}>Create Account</h2>
          <p style={s.subtitle}>Blockchain Microloan Platform</p>
        </div>
        <form onSubmit={handleSubmit} style={s.form}>
          <div style={s.field}>
            <label style={s.label}>Full Name</label>
            <input style={s.input} placeholder="Your full name" required value={form.name} onChange={(e) => f("name", e.target.value)} />
          </div>
          <div style={s.field}>
            <label style={s.label}>Email Address</label>
            <input style={s.input} placeholder="email@example.com" type="email" required value={form.email} onChange={(e) => f("email", e.target.value)} />
          </div>
          <div style={s.field}>
            <label style={s.label}>Password</label>
            <input style={s.input} placeholder="••••••••" type="password" required value={form.password} onChange={(e) => f("password", e.target.value)} />
          </div>
          <div style={s.field}>
            <label style={s.label}>Account Role</label>
            <select style={s.input} value={form.role} onChange={(e) => f("role", e.target.value)}>
              <option value="borrower">MSME Borrower</option>
              <option value="lender">Lender / Investor</option>
              <option value="auditor">Auditor</option>
              <option value="government">Government Official</option>
            </select>
          </div>
          <div style={s.field}>
            <label style={s.label}>MetaMask Wallet</label>
            {connected ? (
              <div style={s.wallet}>✓ Connected: {account?.slice(0, 8)}...{account?.slice(-6)}</div>
            ) : (
              <button type="button" onClick={handleConnect} style={s.connectBtn}>🦊 Connect MetaMask Wallet</button>
            )}
          </div>
          <div style={s.infoBox}>
            {form.role === "borrower" && <p>📋 As an MSME Borrower, you can apply for loans and track milestone-based fund releases.</p>}
            {form.role === "lender" && <p>🏦 As a Lender, you review and approve loan applications on-chain.</p>}
            {form.role === "auditor" && <p>🔍 As an Auditor, you review KYC submissions and monitor loan activity.</p>}
            {form.role === "government" && <p>🏛 Government officials can monitor the full audit trail and system statistics.</p>}
          </div>
          {error && <div style={s.error}>⚠ {error}</div>}
          <button type="submit" style={s.btn} disabled={loading}>{loading ? "Creating Account..." : "Create Account →"}</button>
        </form>
        <p style={s.footer}>Already have an account? <Link to="/login" style={{ color: "#00d4ff" }}>Login</Link></p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   LOGIN
═══════════════════════════════════════════════════════════════════ */
export function Login() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await login(form);
      navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.message || "Invalid credentials");
    } finally {
      setLoading(false);
    }
  };

  const f = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const s = styles;

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ width: 48, height: 48, borderRadius: "50%", background: "rgba(0,212,255,0.1)", border: "1px solid #00d4ff", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px", fontSize: 22 }}>⛓</div>
          <h2 style={s.title}>Welcome Back</h2>
          <p style={s.subtitle}>Login to your account</p>
        </div>
        <form onSubmit={handleSubmit} style={s.form}>
          <div style={s.field}>
            <label style={s.label}>Email Address</label>
            <input style={s.input} placeholder="email@example.com" type="email" required value={form.email} onChange={(e) => f("email", e.target.value)} />
          </div>
          <div style={s.field}>
            <label style={s.label}>Password</label>
            <input style={s.input} placeholder="••••••••" type="password" required value={form.password} onChange={(e) => f("password", e.target.value)} />
          </div>
          {error && <div style={s.error}>⚠ {error}</div>}
          <button type="submit" style={s.btn} disabled={loading}>{loading ? "Logging in..." : "Login →"}</button>
        </form>
        <p style={s.footer}>No account? <Link to="/register" style={{ color: "#00d4ff" }}>Register here</Link></p>
        <div style={{ ...s.infoBox, marginTop: 20 }}>
          <p style={{ margin: 0 }}>🔒 Powered by Ethereum blockchain — all loan transactions are immutable, transparent, and tamper-proof.</p>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   KYC SUBMIT  (fixed: status-check on load, validation, step advance)
═══════════════════════════════════════════════════════════════════ */
export function KYCSubmit() {
  const [form, setForm] = useState({ businessName: "", gstNumber: "", aadhaarNumber: "", panNumber: "", businessType: "", annualTurnover: "" });
  const [submitted, setSubmitted] = useState(null); // { msg, txHash }
  const [kycStatus, setKycStatus] = useState(null); // existing status from server
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(true);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});

  // FIX: load KYC status on mount
  // CRITICAL FIX: only treat as "pending" if a kyc_documents row actually exists
  // Railway MySQL default is 'pending' for brand new users who never submitted anything
  useEffect(() => {
    (async () => {
      try {
        const api = (await import("../utils/api")).default;
        const res = await api.get("/api/kyc/status");
        const st = res.data.kyc_status;
        const hasDoc = !!res.data.document;

        if (st === "verified") {
          setKycStatus("verified");
          setKycDoc(res.data.document);
          setStep(3);
        } else if (st === "pending" && hasDoc) {
          setKycStatus("pending");
          setKycDoc(res.data.document);
          setStep(2);
        } else if (st === "rejected" && hasDoc) {
          setKycStatus("rejected");
          setKycDoc(res.data.document);
          setStep(1);
        } else {
          // new user with default pending but no doc submitted yet — show form
          setKycStatus(null);
          setStep(1);
        }
      } catch (_) { setKycStatus(null); setStep(1); }
      finally { setStatusLoading(false); }
    })();
  }, []);

  // FIX: client-side validation
  const validate = () => {
    const GST_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    const AAD_RE = /^[0-9]{12}$/;
    const e = {};
    if (!form.businessName.trim())                            e.businessName   = "Required";
    if (!GST_RE.test(form.gstNumber))                         e.gstNumber      = "Invalid format (e.g. 29ABCDE1234F1Z5)";
    if (!PAN_RE.test(form.panNumber))                         e.panNumber      = "Invalid format (e.g. ABCDE1234F)";
    if (!AAD_RE.test(form.aadhaarNumber.replace(/\s/g, ""))) e.aadhaarNumber  = "Must be 12 digits";
    if (!form.businessType)                                    e.businessType   = "Required";
    if (!form.annualTurnover || isNaN(Number(form.annualTurnover))) e.annualTurnover = "Enter a valid number";
    setFieldErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!validate()) return;
    setLoading(true);
    try {
      const api = (await import("../utils/api")).default;
      const res = await api.post("/api/kyc/submit", form);
      setSubmitted({ msg: res.data.message, txHash: res.data.txHash });
      setKycStatus("pending");
      setStep(2); // FIX: advance stepper on success
    } catch (err) {
      setError(err.response?.data?.message || "Submission failed");
    } finally {
      setLoading(false);
    }
  };

  const f = (k, v) => { setForm((p) => ({ ...p, [k]: v })); setFieldErrors((p) => ({ ...p, [k]: undefined })); };
  const s = styles;

  // Step tab indicator
  const stepLabels = ["Business Info", "On-Chain Hash", "Verification"];
  const StepTabs = () => (
    <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
      {stepLabels.map((label, i) => {
        const idx = i + 1;
        const active = idx === step;
        const done   = idx < step;
        return (
          <div key={label} style={{ flex: 1, padding: "6px 8px", borderRadius: 4, textAlign: "center", fontSize: 11, fontFamily: "monospace",
            background: active ? "rgba(0,212,255,0.1)" : done ? "rgba(0,255,159,0.08)" : "#0c1829",
            border: `1px solid ${active ? "#00d4ff" : done ? "#00ff9f" : "#1a3a5c"}`,
            color: active ? "#00d4ff" : done ? "#00ff9f" : "#4a7090",
          }}>{done ? "✓ " : ""}{label}</div>
        );
      })}
    </div>
  );

  if (statusLoading) return <div style={s.page}><p style={{ color: "#4a7090", padding: 40 }}>Loading KYC status...</p></div>;

  return (
    <div style={s.page}>
      <div style={{ ...s.card, maxWidth: 540 }}>
        <h2 style={s.title}>KYC Verification</h2>
        <p style={{ ...s.subtitle, marginBottom: 6 }}>Step {step} of 3 — {["Identity Verification", "On-Chain Hash Stored", "Verification Complete"][step - 1]}</p>

        <StepTabs />

        {/* Already verified */}
        {kycStatus === "verified" && !submitted && (
          <div style={s.success}>
            <p style={{ fontWeight: 700 }}>✅ KYC Already Verified</p>
            <p style={{ fontSize: 13, marginTop: 8 }}>Your KYC has been verified. You can now apply for loans.</p>
            <Link to="/loans/apply" style={{ color: "#00d4ff", display: "block", marginTop: 16, fontSize: 13 }}>Apply for a Loan →</Link>
          </div>
        )}

        {/* Already pending */}
        {kycStatus === "pending" && !submitted && (
          <div style={s.warning}>
            <p style={{ fontWeight: 700 }}>⏳ KYC Under Review</p>
            <p style={{ fontSize: 13, marginTop: 8 }}>Your documents have been submitted and are awaiting admin/auditor verification.</p>
            <Link to="/dashboard" style={{ color: "#ffd32a", display: "block", marginTop: 16, fontSize: 13 }}>← Back to Dashboard</Link>
          </div>
        )}

        {/* Success after fresh submit */}
        {submitted && (
          <div style={s.success}>
            <p style={{ fontWeight: 700 }}>✅ {submitted.msg}</p>
            <p style={{ fontSize: 12, color: "#4a7090", marginTop: 8 }}>KYC is now pending admin/auditor verification.</p>
            {submitted.txHash && (
              <div style={{ marginTop: 12 }}>
                <p style={{ fontSize: 11, fontFamily: "monospace", color: "#4a7090" }}>Ethereum Tx Hash:</p>
                <p style={{ fontSize: 11, fontFamily: "monospace", color: "#00d4ff", wordBreak: "break-all", marginTop: 4 }}>{submitted.txHash}</p>
              </div>
            )}
            <Link to="/dashboard" style={{ color: "#00d4ff", display: "block", marginTop: 16, fontSize: 13 }}>← Back to Dashboard</Link>
          </div>
        )}

        {/* Show form only if not yet submitted */}
        {kycStatus !== "verified" && kycStatus !== "pending" && !submitted && (
          <>
            <div style={{ ...s.infoBox, marginBottom: 20 }}>
              <p style={{ margin: 0 }}>🔐 Your document hash is stored on Ethereum. Sensitive data remains encrypted in our secure database — only a cryptographic proof goes on-chain.</p>
            </div>
            {kycStatus === "rejected" && (
              <div style={{ ...s.warning, marginBottom: 16 }}>⚠ Your previous KYC was rejected. You may resubmit with corrected information.</div>
            )}
            <form onSubmit={handleSubmit} style={s.form}>
              <div style={s.field}>
                <label style={s.label}>Business Name</label>
                <input style={{ ...s.input, ...(fieldErrors.businessName ? { borderColor: "#ff4757" } : {}) }} placeholder="Registered business name" value={form.businessName} onChange={(e) => f("businessName", e.target.value)} />
                {fieldErrors.businessName && <span style={{ color: "#ff4757", fontSize: 11 }}>{fieldErrors.businessName}</span>}
              </div>
              <div style={s.field}>
                <label style={s.label}>GST Number</label>
                <input style={{ ...s.input, ...(fieldErrors.gstNumber ? { borderColor: "#ff4757" } : {}) }} placeholder="e.g. 29ABCDE1234F1Z5" value={form.gstNumber} onChange={(e) => f("gstNumber", e.target.value.toUpperCase())} />
                {fieldErrors.gstNumber && <span style={{ color: "#ff4757", fontSize: 11 }}>{fieldErrors.gstNumber}</span>}
              </div>
              <div style={s.grid2}>
                <div style={s.field}>
                  <label style={s.label}>Aadhaar Number</label>
                  <input style={{ ...s.input, ...(fieldErrors.aadhaarNumber ? { borderColor: "#ff4757" } : {}) }} placeholder="XXXX XXXX XXXX" value={form.aadhaarNumber} onChange={(e) => f("aadhaarNumber", e.target.value)} />
                  {fieldErrors.aadhaarNumber && <span style={{ color: "#ff4757", fontSize: 11 }}>{fieldErrors.aadhaarNumber}</span>}
                </div>
                <div style={s.field}>
                  <label style={s.label}>PAN Number</label>
                  <input style={{ ...s.input, ...(fieldErrors.panNumber ? { borderColor: "#ff4757" } : {}) }} placeholder="ABCDE1234F" value={form.panNumber} onChange={(e) => f("panNumber", e.target.value.toUpperCase())} />
                  {fieldErrors.panNumber && <span style={{ color: "#ff4757", fontSize: 11 }}>{fieldErrors.panNumber}</span>}
                </div>
              </div>
              <div style={s.grid2}>
                <div style={s.field}>
                  <label style={s.label}>Business Type</label>
                  <select style={{ ...s.input, ...(fieldErrors.businessType ? { borderColor: "#ff4757" } : {}) }} value={form.businessType} onChange={(e) => f("businessType", e.target.value)}>
                    <option value="">Select type</option>
                    <option value="Sole Proprietorship">Sole Proprietorship</option>
                    <option value="Partnership">Partnership</option>
                    <option value="Private Limited">Private Limited</option>
                    <option value="LLP">LLP</option>
                    <option value="OPC">OPC</option>
                    <option value="manufacturing">Manufacturing</option>
                    <option value="services">Services</option>
                    <option value="trading">Trading</option>
                    <option value="retail">Retail</option>
                  </select>
                  {fieldErrors.businessType && <span style={{ color: "#ff4757", fontSize: 11 }}>{fieldErrors.businessType}</span>}
                </div>
                <div style={s.field}>
                  <label style={s.label}>Annual Turnover (₹)</label>
                  <input style={{ ...s.input, ...(fieldErrors.annualTurnover ? { borderColor: "#ff4757" } : {}) }} placeholder="e.g. 5000000" type="number" value={form.annualTurnover} onChange={(e) => f("annualTurnover", e.target.value)} />
                  {fieldErrors.annualTurnover && <span style={{ color: "#ff4757", fontSize: 11 }}>{fieldErrors.annualTurnover}</span>}
                </div>
              </div>
              {error && <div style={s.error}>⚠ {error}</div>}
              <button style={s.btn} type="submit" disabled={loading}>{loading ? "Submitting to Blockchain..." : "Submit KYC Documents →"}</button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   APPLY LOAN
═══════════════════════════════════════════════════════════════════ */
export function ApplyLoan() {
  const [form, setForm] = useState({ amountEth: "", tenureMonths: "12", collateral: "", purpose: "" });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { connected } = useWeb3();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!connected) return setError("Connect MetaMask first");
    setLoading(true);
    setError("");
    try {
      const { ethers } = await import("ethers");
      const api = (await import("../utils/api")).default;
      const amountWei = ethers.parseEther(form.amountEth).toString();
      const res = await api.post("/api/loans/apply", {
        amountWei, interestRate: 1200,
        tenureMonths: Number(form.tenureMonths),
        collateral: form.collateral, purpose: form.purpose,
      });
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  const f = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const s = styles;
  const ethAmt = parseFloat(form.amountEth) || 0;
  const months = parseInt(form.tenureMonths) || 12;
  const rate = 0.12 / 12;
  const emi = ethAmt > 0 ? ((ethAmt * rate * Math.pow(1 + rate, months)) / (Math.pow(1 + rate, months) - 1)).toFixed(6) : "—";

  return (
    <div style={s.page}>
      <div style={{ ...s.card, maxWidth: 540 }}>
        <h2 style={s.title}>Apply for Loan</h2>
        <p style={s.subtitle}>MSME Blockchain-Backed Microloan</p>
        {result ? (
          <div>
            <div style={result.status === "REJECTED" ? s.error : s.success}>
              <p style={{ fontWeight: 700, fontSize: 16 }}>{result.status === "REJECTED" ? "❌ Application Rejected" : "✅ Application Submitted"}</p>
              <hr style={s.divider} />
              <p><span style={{ color: "#4a7090" }}>Credit Score: </span><strong>{result.creditScore}</strong></p>
              <p><span style={{ color: "#4a7090" }}>Status: </span><strong>{result.status}</strong></p>
              {result.rejectReason && <p><span style={{ color: "#4a7090" }}>Reason: </span>{result.rejectReason}</p>}
              {result.loanIdHash && (
                <div style={{ marginTop: 12 }}>
                  <p style={{ fontSize: 11, color: "#4a7090", fontFamily: "monospace" }}>Loan ID (On-chain):</p>
                  <p style={{ fontSize: 11, fontFamily: "monospace", wordBreak: "break-all", color: "#00d4ff" }}>{result.loanIdHash}</p>
                </div>
              )}
            </div>
            <Link to="/dashboard" style={{ color: "#00d4ff", display: "block", marginTop: 16, fontSize: 13 }}>← Back to Dashboard</Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={s.form}>
            <div style={s.field}>
              <label style={s.label}>Loan Purpose</label>
              <select style={s.input} value={form.purpose} onChange={(e) => f("purpose", e.target.value)}>
                <option value="">Select purpose</option>
                <option value="equipment">Equipment Purchase</option>
                <option value="working_capital">Working Capital</option>
                <option value="expansion">Business Expansion</option>
                <option value="inventory">Inventory</option>
                <option value="technology">Technology Upgrade</option>
              </select>
            </div>
            <div style={s.grid2}>
              <div style={s.field}>
                <label style={s.label}>Loan Amount (ETH)</label>
                <input style={s.input} type="number" step="0.001" required placeholder="e.g. 0.1" value={form.amountEth} onChange={(e) => f("amountEth", e.target.value)} />
              </div>
              <div style={s.field}>
                <label style={s.label}>Tenure (Months)</label>
                <select style={s.input} value={form.tenureMonths} onChange={(e) => f("tenureMonths", e.target.value)}>
                  {[6, 12, 18, 24, 36].map((m) => (<option key={m} value={m}>{m} months</option>))}
                </select>
              </div>
            </div>
            <div style={s.field}>
              <label style={s.label}>Collateral Description</label>
              <textarea style={{ ...s.input, height: 70, resize: "vertical" }} placeholder="Describe collateral assets" value={form.collateral} onChange={(e) => f("collateral", e.target.value)} />
            </div>
            {ethAmt > 0 && (
              <div style={{ ...s.infoBox, borderColor: "#00d4ff" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Estimated Monthly EMI</span>
                  <span style={{ color: "#00d4ff", fontFamily: "monospace", fontWeight: 700 }}>{emi} ETH</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                  <span>Interest Rate</span>
                  <span style={{ color: "#ffd32a", fontFamily: "monospace" }}>12% p.a.</span>
                </div>
              </div>
            )}
            {error && <div style={s.error}>⚠ {error}</div>}
            <button type="submit" style={s.btn} disabled={loading}>{loading ? "Submitting to Blockchain..." : "Submit Loan Application →"}</button>
          </form>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   DASHBOARD — Routes to role-specific dashboard
═══════════════════════════════════════════════════════════════════ */
export function Dashboard() {
  const { user, logout } = useAuth();
  const { account, connectWallet, connected } = useWeb3();

  if (!user) return <div style={styles.page}><p style={{ color: "#4a7090", padding: 40 }}>Loading...</p></div>;

  if (user.role === "lender") return <LenderDashboard user={user} logout={logout} account={account} connectWallet={connectWallet} connected={connected} />;
  if (user.role === "auditor") return <AuditorDashboard user={user} logout={logout} />;
  if (user.role === "government") return <GovernmentDashboard user={user} logout={logout} />;
  return <BorrowerDashboard user={user} logout={logout} account={account} connectWallet={connectWallet} connected={connected} />;
}

/* ─── BORROWER DASHBOARD ─────────────────────────────────────────── */
function BorrowerDashboard({ user, logout, account, connectWallet, connected }) {
  const [loans, setLoans] = useState([]);
  const [stats, setStats] = useState({ total: 0, active: 0, completed: 0, pending: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const s = styles;

  useEffect(() => {
    const fetchLoans = async () => {
      try {
        const api = (await import("../utils/api")).default;
        const res = await api.get("/api/loans/my");
        const all = res.data.loans || [];
        setLoans(all);
        setStats({
          total: all.length,
          active: all.filter((l) => l.status === "ACTIVE").length,
          completed: all.filter((l) => l.status === "COMPLETED").length,
          pending: all.filter((l) => l.status === "PENDING").length,
        });
      } catch (e) { console.error(e); } finally { setIsLoading(false); }
    };
    fetchLoans();
  }, []);

  return (
    <div style={s.page}>
      <Navbar user={user} onLogout={logout} />
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "28px 20px" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
          <div>
            <h1 style={{ ...s.title, color: "#00d4ff", marginBottom: 4 }}>Welcome, {user?.name} 👋</h1>
            <p style={{ color: "#4a7090", fontSize: 13, fontFamily: "monospace" }}>MSME Borrower Portal</p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
              <span style={s.tag}>BORROWER</span>
              <span style={{ ...s.tag, borderColor: user?.kyc_status === "verified" ? "#00ff9f" : "#ffd32a", color: user?.kyc_status === "verified" ? "#00ff9f" : "#ffd32a" }}>
                KYC: {user?.kyc_status?.toUpperCase() || "PENDING"}
              </span>
              {connected && <span style={{ ...s.tag, color: "#00ff9f", borderColor: "#00ff9f" }}>🦊 {account?.slice(0, 6)}...{account?.slice(-4)}</span>}
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            {!connected && <button onClick={connectWallet} style={s.connectBtn}>🦊 Connect Wallet</button>}
            {user?.kyc_status === "verified" && (
              <Link to="/loans/apply" style={{ ...s.btn, display: "inline-block", textDecoration: "none", padding: "10px 20px" }}>+ Apply for Loan</Link>
            )}
          </div>
        </div>

        {/* KYC Warning */}
        {user?.kyc_status !== "verified" && (
          <div style={{ ...s.warning, marginBottom: 20 }}>
            ⚠ Your KYC is {user?.kyc_status === "pending" ? "pending admin verification" : "not submitted yet"}.{" "}
            {user?.kyc_status !== "pending" && <Link to="/kyc" style={{ color: "#ffd32a", fontWeight: 700 }}>Submit KYC →</Link>}
          </div>
        )}

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px,1fr))", gap: 12, marginBottom: 28 }}>
          <StatCard label="TOTAL LOANS" value={stats.total} color="#00d4ff" icon="📋" />
          <StatCard label="ACTIVE" value={stats.active} color="#00ff9f" icon="✅" />
          <StatCard label="PENDING" value={stats.pending} color="#ffd32a" icon="⏳" />
          <StatCard label="COMPLETED" value={stats.completed} color="#a78bfa" icon="🏆" />
        </div>

        {/* Active loan summary */}
        {loans.filter(l => l.status === "ACTIVE").length > 0 && (
          <>
            <h2 style={s.sectionTitle}>🔥 Active Loans — Action Required</h2>
            {loans.filter(l => l.status === "ACTIVE").map((loan) => (
              <Link key={loan.id} to={`/loans/${loan.id}`} style={{ ...s.loanCard, borderColor: "#00ff9f" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <p style={{ fontWeight: 700, color: "#00ff9f" }}>Loan #{loan.id}</p>
                      <StatusBadge status={loan.status} />
                    </div>
                    <p style={{ color: "#4a7090", fontSize: 12 }}>
                      Tenure: {loan.tenure_months}m · Score: <span style={{ color: "#00ff9f" }}>{loan.credit_score}</span> · Click to submit milestone proofs
                    </p>
                  </div>
                  <span style={{ color: "#00ff9f", fontSize: 20 }}>›</span>
                </div>
              </Link>
            ))}
          </>
        )}

        {/* All loans */}
        <h2 style={s.sectionTitle}>All Loan Applications</h2>
        {isLoading ? (
          <p style={{ color: "#4a7090", fontFamily: "monospace" }}>Loading blockchain data...</p>
        ) : loans.length === 0 ? (
          <div style={s.empty}>
            <p style={{ marginBottom: 12 }}>No loans yet.</p>
            {user?.kyc_status === "verified"
              ? <Link to="/loans/apply" style={{ color: "#00d4ff" }}>Apply for your first loan →</Link>
              : <p style={{ color: "#ffd32a", fontSize: 12 }}>Complete KYC verification first to apply for loans.</p>
            }
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {loans.map((loan) => (
              <Link key={loan.id} to={`/loans/${loan.id}`} style={s.loanCard}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <p style={{ fontWeight: 700, color: "#c8e0f4" }}>Loan #{loan.id}</p>
                      <StatusBadge status={loan.status} />
                    </div>
                    <div style={{ display: "flex", gap: 16 }}>
                      <span style={{ color: "#4a7090", fontSize: 12 }}>Applied: {new Date(loan.applied_at).toLocaleDateString()}</span>
                      <span style={{ color: "#4a7090", fontSize: 12 }}>Score: <span style={{ color: "#00ff9f" }}>{loan.credit_score}</span></span>
                      <span style={{ color: "#4a7090", fontSize: 12 }}>Tenure: {loan.tenure_months}m</span>
                    </div>
                  </div>
                  <span style={{ color: "#4a7090", fontSize: 18 }}>›</span>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* How to guide */}
        <div style={{ ...s.infoBox, marginTop: 28 }}>
          <p style={{ fontWeight: 700, color: "#c8e0f4", marginBottom: 8 }}>📌 How to Get Your Loan Funded:</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 12 }}>
            {[["1. KYC Verification", "Submit business documents"], ["2. Apply for Loan", "Fill loan application form"], ["3. Lender Approval", "Wait for lender to approve on-chain"], ["4. Milestone Proofs", "Submit bills to release funds stage-by-stage"]].map(([title, desc]) => (
              <div key={title} style={{ background: "#060d1a", border: "1px solid #1a3a5c", borderRadius: 4, padding: "8px 10px" }}>
                <p style={{ color: "#00d4ff", fontSize: 11, fontFamily: "monospace" }}>{title}</p>
                <p style={{ color: "#4a7090" }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── LENDER DASHBOARD ───────────────────────────────────────────── */
function LenderDashboard({ user, logout, account, connectWallet, connected }) {
  const [pendingLoans, setPendingLoans] = useState([]);
  const [myApprovedLoans, setMyApprovedLoans] = useState([]);
  const [stats, setStats] = useState({ pending: 0, approved: 0, active: 0, totalInvested: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const s = styles;

  useEffect(() => {
    const fetchData = async () => {
      try {
        const api = (await import("../utils/api")).default;
        const [pendingRes, myRes] = await Promise.all([
          api.get("/api/loans/pending"),
          api.get("/api/loans/my-approved"),
        ]);
        const pending = pendingRes.data.loans || [];
        const approved = myRes.data.loans || [];
        setPendingLoans(pending);
        setMyApprovedLoans(approved);
        setStats({
          pending: pending.length,
          approved: approved.filter(l => l.status === "APPROVED").length,
          active: approved.filter(l => l.status === "ACTIVE").length,
          completed: approved.filter(l => l.status === "COMPLETED").length,
        });
      } catch (e) { console.error(e); } finally { setIsLoading(false); }
    };
    fetchData();
  }, []);

  return (
    <div style={s.page}>
      <Navbar user={user} onLogout={logout} />
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "28px 20px" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
          <div>
            <h1 style={{ ...s.title, color: "#00ff9f", marginBottom: 4 }}>Lender Dashboard</h1>
            <p style={{ color: "#4a7090", fontSize: 13, fontFamily: "monospace" }}>Welcome, {user?.name} — Investor Portal</p>
            <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
              <span style={{ ...s.tag, color: "#00ff9f", borderColor: "#00ff9f" }}>LENDER</span>
              {connected && <span style={{ ...s.tag, color: "#00ff9f", borderColor: "#00ff9f" }}>🦊 {account?.slice(0, 6)}...{account?.slice(-4)}</span>}
            </div>
          </div>
          {!connected && <button onClick={connectWallet} style={{ ...s.connectBtn, borderColor: "#00ff9f", color: "#00ff9f" }}>🦊 Connect Wallet to Approve Loans</button>}
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px,1fr))", gap: 12, marginBottom: 28 }}>
          <StatCard label="PENDING REVIEW" value={stats.pending} color="#ffd32a" icon="⏳" sub="Awaiting your decision" />
          <StatCard label="APPROVED" value={stats.approved} color="#00d4ff" icon="✅" />
          <StatCard label="ACTIVE" value={stats.active} color="#00ff9f" icon="🔥" sub="Funds deployed" />
          <StatCard label="COMPLETED" value={stats.completed} color="#a78bfa" icon="🏆" sub="Fully repaid" />
        </div>

        {/* Pending loans to review */}
        <h2 style={{ ...s.sectionTitle, color: "#ffd32a" }}>⚡ Pending Loan Requests — Action Required</h2>
        {isLoading ? (
          <p style={{ color: "#4a7090", fontFamily: "monospace" }}>Loading...</p>
        ) : pendingLoans.length === 0 ? (
          <div style={s.empty}><p>No pending loan requests at this time.</p></div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {pendingLoans.map((loan) => (
              <LenderLoanCard key={loan.id} loan={loan} />
            ))}
          </div>
        )}

        {/* My approved loans */}
        <h2 style={{ ...s.sectionTitle, color: "#00ff9f" }}>💰 My Investments</h2>
        {myApprovedLoans.length === 0 ? (
          <div style={s.empty}><p>You haven't approved any loans yet.</p></div>
        ) : (
          <div style={{ ...s.card, padding: 0, overflow: "hidden", margin: 0 }}>
            <table style={s.table}>
              <thead>
                <tr>
                  {["Loan #", "Borrower", "Business", "Amount (Wei)", "Tenure", "Status", "Milestones"].map(h => (
                    <th key={h} style={s.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {myApprovedLoans.map((loan) => {
                  const released = (loan.milestones || []).filter(m => m.status === "RELEASED").length;
                  return (
                    <tr key={loan.id}>
                      <td style={s.td}>#{loan.id}</td>
                      <td style={s.td}>{loan.borrower_name}</td>
                      <td style={s.td}>{loan.business_name || "—"}</td>
                      <td style={{ ...s.td, fontFamily: "monospace", fontSize: 11, color: "#4a7090" }}>{loan.amount_wei}</td>
                      <td style={s.td}>{loan.tenure_months}m</td>
                      <td style={s.td}><StatusBadge status={loan.status} /></td>
                      <td style={s.td}>
                        <span style={{ color: "#00ff9f", fontFamily: "monospace" }}>{released}/4</span>
                        <span style={{ color: "#4a7090", fontSize: 11 }}> released</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ ...s.infoBox, marginTop: 28 }}>
          <p style={{ margin: 0 }}>🏦 As a lender, your approved loans are tracked on-chain. Funds are released to borrowers in milestones only after proof of use is verified — protecting your investment.</p>
        </div>
      </div>
    </div>
  );
}

function LenderLoanCard({ loan }) {
  const { approveLoanOnChain, rejectLoanOnChain, depositFundsOnChain, connected } = useWeb3();
  const s = styles;
  const scoreColor = (score) => score >= 700 ? "#00ff9f" : score >= 500 ? "#ffd32a" : "#ff4757";

  const handleApprove = async () => {
    if (!connected) return alert("Connect MetaMask first");
    try {
      const receipt = await approveLoanOnChain(loan.loan_id_hash);
      const api = (await import("../utils/api")).default;
      await api.post(`/api/loans/${loan.id}/approve`, { txHash: receipt.hash });
      const shouldDeposit = window.confirm("Loan approved! Deposit funds now? (Releases 20% to borrower)");
      if (shouldDeposit) await depositFundsOnChain(loan.loan_id_hash, loan.amount_wei);
      alert("✅ Done!");
      window.location.reload();
    } catch (err) { alert(err.message); }
  };

  const handleReject = async () => {
    const reason = prompt("Reason for rejection:");
    if (!reason) return;
    try {
      await rejectLoanOnChain(loan.loan_id_hash, reason);
      const api = (await import("../utils/api")).default;
      await api.post(`/api/loans/${loan.id}/reject`, { reason });
      alert("Loan rejected.");
      window.location.reload();
    } catch (err) { alert(err.message); }
  };

  return (
    <div style={{ ...s.loanCard, borderColor: "#ffd32a" }}>
      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <p style={{ color: "#00d4ff", fontWeight: 700, fontSize: 16, marginBottom: 4 }}>
            {loan.business_name || loan.borrower_name}
            <span style={{ color: "#4a7090", fontWeight: 400, fontSize: 13 }}> — Loan #{loan.id}</span>
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <span style={{ color: "#4a7090", fontSize: 12 }}>Credit Score:</span>
            <span style={{ color: scoreColor(loan.credit_score), fontWeight: 700, fontFamily: "monospace" }}>{loan.credit_score}</span>
            <div style={{ ...s.progressBar, flex: 1, height: 4 }}>
              <div style={{ width: `${Math.min((loan.credit_score / 900) * 100, 100)}%`, height: "100%", background: scoreColor(loan.credit_score), borderRadius: 2 }} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            <span style={{ color: "#4a7090", fontSize: 12 }}>Tenure: <span style={{ color: "#c8e0f4" }}>{loan.tenure_months}m</span></span>
            <span style={{ color: "#4a7090", fontSize: 12 }}>Turnover: <span style={{ color: "#c8e0f4" }}>₹{Number(loan.annual_turnover || 0).toLocaleString()}</span></span>
            <span style={{ color: "#4a7090", fontSize: 12 }}>Business: <span style={{ color: "#c8e0f4" }}>{loan.business_type || "—"}</span></span>
            <span style={{ color: "#4a7090", fontSize: 12 }}>GST: <span style={{ color: "#c8e0f4", fontFamily: "monospace" }}>{loan.gst_number || "—"}</span></span>
          </div>
          {loan.collateral && (
            <p style={{ color: "#4a7090", fontSize: 12, marginTop: 6 }}>Collateral: {loan.collateral}</p>
          )}
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button onClick={handleApprove} style={{ ...s.btn, background: "linear-gradient(135deg,#00ff9f,#00cc7a)", padding: "8px 20px", fontSize: 13 }}>✅ Approve</button>
          <button onClick={handleReject} style={{ ...s.btn, background: "linear-gradient(135deg,#ff4757,#cc0018)", padding: "8px 20px", fontSize: 13 }}>❌ Reject</button>
        </div>
      </div>
    </div>
  );
}

/* ─── AUDITOR DASHBOARD ──────────────────────────────────────────── */
function AuditorDashboard({ user, logout }) {
  const [pendingKYC, setPendingKYC] = useState([]);
  const [recentLoans, setRecentLoans] = useState([]);
  const [stats, setStats] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState(null); // FIX: per-button loading
  const s = styles;

  // FIX: extracted so we can re-call after verify/reject without page reload
  const fetchData = async () => {
    setIsLoading(true);
    try {
      const api = (await import("../utils/api")).default;
      const [kycRes, dashRes] = await Promise.all([
        api.get("/api/kyc/pending"),
        api.get("/api/admin/dashboard"),
      ]);
      setPendingKYC(kycRes.data.pending || []);
      setStats(dashRes.data.stats || {});
      setRecentLoans(dashRes.data.recentLoans || []);
    } catch (e) { console.error(e); } finally { setIsLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  // FIX: no window.location.reload — just re-fetch and remove item from list
  const handleKYC = async (userId, status) => {
    if (!window.confirm(`${status === "verified" ? "Verify" : "Reject"} this KYC submission?`)) return;
    setActionLoadingId(userId);
    try {
      const api = (await import("../utils/api")).default;
      await api.post(`/api/kyc/verify/${userId}`, { status });
      // Remove from list immediately for instant feedback, then re-fetch stats
      setPendingKYC((prev) => prev.filter((u) => u.id !== userId));
      setStats((prev) => ({ ...prev, pending_kyc: Math.max(0, (prev.pending_kyc || 0) - 1) }));
    } catch (e) {
      alert(e.response?.data?.message || "Failed to update KYC");
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div style={s.page}>
      <Navbar user={user} onLogout={logout} />
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "28px 20px" }}>

        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ ...s.title, color: "#a78bfa", marginBottom: 4 }}>Auditor Dashboard</h1>
          <p style={{ color: "#4a7090", fontSize: 13, fontFamily: "monospace" }}>Welcome, {user?.name} — KYC & Compliance Officer</p>
          <span style={{ ...s.tag, color: "#a78bfa", borderColor: "#a78bfa" }}>AUDITOR</span>
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px,1fr))", gap: 12, marginBottom: 28 }}>
          <StatCard label="PENDING KYC" value={pendingKYC.length} color="#ffd32a" icon="📋" sub="Requires your review" />
          <StatCard label="TOTAL LOANS" value={stats.total_loans} color="#a78bfa" icon="📊" />
          <StatCard label="ACTIVE LOANS" value={stats.active} color="#00ff9f" icon="✅" />
          <StatCard label="REJECTED" value={stats.rejected} color="#ff4757" icon="❌" />
        </div>

        {/* Pending KYC — primary action */}
        <h2 style={{ ...s.sectionTitle, color: "#ffd32a" }}>⚠️ Pending KYC Verifications ({pendingKYC.length})</h2>
        {isLoading ? (
          <p style={{ color: "#4a7090", fontFamily: "monospace" }}>Loading...</p>
        ) : pendingKYC.length === 0 ? (
          <div style={s.empty}><p>✅ All KYC submissions have been reviewed.</p></div>
        ) : (
          pendingKYC.map((u) => (
            <div key={u.id} style={{ ...s.loanCard, borderColor: "#ffd32a", marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <p style={{ color: "#c8e0f4", fontWeight: 600, fontSize: 15 }}>{u.name}</p>
                  <p style={{ color: "#00d4ff", fontSize: 13, marginTop: 2 }}>{u.business_name}</p>
                  <div style={{ display: "flex", gap: 14, marginTop: 6, flexWrap: "wrap" }}>
                    <span style={{ color: "#4a7090", fontSize: 12 }}>GST: <span style={{ color: "#c8e0f4", fontFamily: "monospace" }}>{u.gst_number}</span></span>
                    <span style={{ color: "#4a7090", fontSize: 12 }}>PAN: <span style={{ color: "#c8e0f4", fontFamily: "monospace" }}>{u.pan_number || "—"}</span></span>
                    <span style={{ color: "#4a7090", fontSize: 12 }}>Aadhaar: <span style={{ color: "#c8e0f4", fontFamily: "monospace" }}>{u.aadhaar_number}</span></span>
                    <span style={{ color: "#4a7090", fontSize: 12 }}>Type: <span style={s.tag}>{u.business_type}</span></span>
                    <span style={{ color: "#4a7090", fontSize: 12 }}>Turnover: <span style={{ color: "#00ff9f" }}>₹{Number(u.annual_turnover || 0).toLocaleString()}</span></span>
                  </div>
                  <p style={{ color: "#4a7090", fontSize: 11, marginTop: 4, fontFamily: "monospace" }}>
                    Wallet: {u.wallet_address} · Role: <span style={s.tag}>{u.role}</span>
                  </p>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => handleKYC(u.id, "verified")} disabled={actionLoadingId === u.id} style={{ ...s.btn, background: "linear-gradient(135deg,#00ff9f,#00cc7a)", padding: "8px 20px", fontSize: 13, opacity: actionLoadingId === u.id ? 0.6 : 1 }}>{actionLoadingId === u.id ? "..." : "Verify ✅"}</button>
                  <button onClick={() => handleKYC(u.id, "rejected")} disabled={actionLoadingId === u.id} style={{ ...s.btn, background: "linear-gradient(135deg,#ff4757,#cc0018)", padding: "8px 20px", fontSize: 13, opacity: actionLoadingId === u.id ? 0.6 : 1 }}>{actionLoadingId === u.id ? "..." : "Reject ❌"}</button>
                </div>
              </div>
            </div>
          ))
        )}

        {/* Recent loan activity */}
        <h2 style={{ ...s.sectionTitle, color: "#a78bfa" }}>📊 Recent Loan Activity</h2>
        {recentLoans.length === 0 ? (
          <div style={s.empty}><p>No loan activity yet.</p></div>
        ) : (
          <div style={{ ...s.card, padding: 0, overflow: "hidden", margin: 0 }}>
            <table style={s.table}>
              <thead>
                <tr>
                  {["Loan #", "Borrower", "Status", "Credit Score", "Applied", "Tenure"].map(h => <th key={h} style={s.th}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {recentLoans.slice(0, 10).map((loan) => (
                  <tr key={loan.id}>
                    <td style={s.td}>#{loan.id}</td>
                    <td style={s.td}>{loan.borrower_name}</td>
                    <td style={s.td}><StatusBadge status={loan.status} /></td>
                    <td style={{ ...s.td, color: loan.credit_score >= 700 ? "#00ff9f" : loan.credit_score >= 500 ? "#ffd32a" : "#ff4757", fontFamily: "monospace" }}>{loan.credit_score}</td>
                    <td style={{ ...s.td, color: "#4a7090", fontSize: 12 }}>{new Date(loan.applied_at).toLocaleDateString()}</td>
                    <td style={s.td}>{loan.tenure_months}m</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ ...s.infoBox, marginTop: 28 }}>
          <p style={{ margin: 0 }}>🔍 As an Auditor, you verify KYC documents and monitor loan compliance. Your verification is required before any borrower can apply for loans.</p>
        </div>
      </div>
    </div>
  );
}

/* ─── GOVERNMENT DASHBOARD ───────────────────────────────────────── */
function GovernmentDashboard({ user, logout }) {
  const [stats, setStats] = useState({});
  const [allLoans, setAllLoans] = useState([]);
  const [logs, setLogs] = useState([]);
  const [activeTab, setActiveTab] = useState("overview");
  const s = styles;

  useEffect(() => {
    const fetchData = async () => {
      try {
        const api = (await import("../utils/api")).default;
        const [dashRes, logsRes] = await Promise.all([
          api.get("/api/admin/dashboard"),
          api.get("/api/admin/audit-logs"),
        ]);
        setStats(dashRes.data.stats || {});
        setAllLoans(dashRes.data.recentLoans || []);
        setLogs(logsRes.data.logs || []);
      } catch (e) { console.error(e); }
    };
    fetchData();
  }, []);

  const tabs = ["overview", "all loans", "audit trail", "system"];

  return (
    <div style={s.page}>
      <Navbar user={user} onLogout={logout} />
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 20px" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
          <div>
            <h1 style={{ ...s.title, color: "#ffd32a", marginBottom: 4 }}>Government Dashboard</h1>
            <p style={{ color: "#4a7090", fontSize: 13, fontFamily: "monospace" }}>Welcome, {user?.name} — National MSME Loan Oversight</p>
            <span style={{ ...s.tag, color: "#ffd32a", borderColor: "#ffd32a" }}>GOVERNMENT OFFICIAL</span>
          </div>
          <div style={{ ...s.infoBox, maxWidth: 280, fontSize: 12 }}>
            🏛 Full read-only access to all platform data. Immutable blockchain records ensure zero corruption.
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px,1fr))", gap: 12, marginBottom: 28 }}>
          <StatCard label="TOTAL LOANS" value={stats.total_loans} color="#ffd32a" icon="📋" />
          <StatCard label="PENDING" value={stats.pending} color="#4a7090" icon="⏳" />
          <StatCard label="ACTIVE" value={stats.active} color="#00ff9f" icon="✅" />
          <StatCard label="COMPLETED" value={stats.completed} color="#a78bfa" icon="🏆" />
          <StatCard label="REJECTED" value={stats.rejected} color="#ff4757" icon="❌" />
          <StatCard label="DEFAULTED" value={stats.defaulted} color="#ff4757" icon="⚠️" />
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 24 }}>
          {tabs.map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{ ...s.smallBtn, borderColor: activeTab === tab ? "#ffd32a" : "#1a3a5c", color: activeTab === tab ? "#ffd32a" : "#4a7090", background: activeTab === tab ? "rgba(255,211,42,0.08)" : "transparent", textTransform: "uppercase", letterSpacing: 1, fontSize: 11 }}>
              {tab}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === "overview" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
              <div style={s.infoBox}>
                <p style={{ fontWeight: 700, color: "#ffd32a", marginBottom: 12, fontSize: 14 }}>📊 Loan Portfolio Summary</p>
                {[["Total Applications", stats.total_loans || 0], ["Approval Rate", stats.total_loans ? `${Math.round(((stats.active || 0) + (stats.completed || 0)) / stats.total_loans * 100)}%` : "0%"], ["Default Rate", stats.total_loans ? `${Math.round((stats.defaulted || 0) / stats.total_loans * 100)}%` : "0%"], ["Active Loans", stats.active || 0]].map(([k, v]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #1a3a5c" }}>
                    <span style={{ color: "#4a7090", fontSize: 13 }}>{k}</span>
                    <span style={{ color: "#ffd32a", fontFamily: "monospace", fontWeight: 700 }}>{v}</span>
                  </div>
                ))}
              </div>
              <div style={s.infoBox}>
                <p style={{ fontWeight: 700, color: "#ffd32a", marginBottom: 12, fontSize: 14 }}>🏛 Transparency Report</p>
                <p style={{ fontSize: 12, lineHeight: 1.8 }}>
                  All loan transactions are immutably recorded on the Ethereum blockchain. No official can modify, delete, or tamper with any record. This ensures zero corruption and full accountability.
                </p>
                <div style={{ marginTop: 12 }}>
                  <span style={{ ...s.tag, color: "#00ff9f", borderColor: "#00ff9f" }}>⛓ Blockchain Verified</span>
                  <span style={{ ...s.tag, color: "#00d4ff", borderColor: "#00d4ff", marginLeft: 8 }}>🔒 Tamper-Proof</span>
                </div>
              </div>
            </div>
            <h2 style={{ ...s.sectionTitle, color: "#ffd32a" }}>Recent Platform Activity</h2>
            <div style={{ ...s.card, padding: 0, overflow: "hidden", margin: 0 }}>
              <table style={s.table}>
                <thead><tr>{["Loan #", "Borrower", "Status", "Score", "Applied"].map(h => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {allLoans.slice(0, 8).map((loan) => (
                    <tr key={loan.id}>
                      <td style={s.td}>#{loan.id}</td>
                      <td style={s.td}>{loan.borrower_name}</td>
                      <td style={s.td}><StatusBadge status={loan.status} /></td>
                      <td style={{ ...s.td, color: "#00ff9f", fontFamily: "monospace" }}>{loan.credit_score}</td>
                      <td style={{ ...s.td, color: "#4a7090", fontSize: 12 }}>{new Date(loan.applied_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* All Loans Tab */}
        {activeTab === "all loans" && (
          <div>
            <h2 style={{ ...s.sectionTitle, color: "#ffd32a" }}>All Loan Applications ({allLoans.length})</h2>
            <div style={{ ...s.card, padding: 0, overflow: "hidden", margin: 0 }}>
              <table style={s.table}>
                <thead><tr>{["Loan #", "Borrower", "Business", "Amount (Wei)", "Status", "Score", "Tenure", "Applied"].map(h => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {allLoans.map((loan) => (
                    <tr key={loan.id}>
                      <td style={s.td}>#{loan.id}</td>
                      <td style={s.td}>{loan.borrower_name}</td>
                      <td style={{ ...s.td, color: "#4a7090" }}>{loan.business_name || "—"}</td>
                      <td style={{ ...s.td, fontFamily: "monospace", fontSize: 11, color: "#4a7090" }}>{loan.amount_wei}</td>
                      <td style={s.td}><StatusBadge status={loan.status} /></td>
                      <td style={{ ...s.td, color: "#00ff9f", fontFamily: "monospace" }}>{loan.credit_score}</td>
                      <td style={s.td}>{loan.tenure_months}m</td>
                      <td style={{ ...s.td, color: "#4a7090", fontSize: 12 }}>{new Date(loan.applied_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {allLoans.length === 0 && <div style={{ ...s.empty, borderRadius: 0 }}><p>No loans found.</p></div>}
            </div>
          </div>
        )}

        {/* Audit Trail Tab */}
        {activeTab === "audit trail" && (
          <div>
            <h2 style={{ ...s.sectionTitle, color: "#ffd32a" }}>Immutable Audit Trail ({logs.length} records)</h2>
            <div style={{ ...s.card, padding: 0, overflow: "hidden", margin: 0 }}>
              <table style={s.table}>
                <thead><tr>{["Timestamp", "Action", "Actor Wallet", "Loan ID", "Tx Hash"].map(h => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {logs.slice(0, 50).map((log) => {
                    const actionColors = { KYC_SUBMITTED: "#00d4ff", KYC_VERIFIED: "#00ff9f", LOAN_APPLIED: "#ffd32a", LOAN_APPROVED: "#00ff9f", LOAN_REJECTED: "#ff4757", MILESTONE_RELEASED: "#a78bfa" };
                    const c = actionColors[log.action] || "#c8e0f4";
                    return (
                      <tr key={log.id}>
                        <td style={{ ...s.td, color: "#4a7090", fontSize: 12 }}>{new Date(log.created_at).toLocaleString()}</td>
                        <td style={s.td}><span style={{ color: c, fontFamily: "monospace", fontSize: 11, border: "1px solid currentColor", padding: "2px 6px", borderRadius: 3 }}>{log.action}</span></td>
                        <td style={{ ...s.td, color: "#4a7090", fontFamily: "monospace", fontSize: 11 }}>{log.actor_wallet ? `${log.actor_wallet.slice(0, 10)}...` : "—"}</td>
                        <td style={{ ...s.td, fontFamily: "monospace" }}>{log.loan_id || "—"}</td>
                        <td style={{ ...s.td, color: "#00d4ff", fontFamily: "monospace", fontSize: 11 }}>{log.tx_hash ? `${log.tx_hash.slice(0, 14)}...` : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {logs.length === 0 && <div style={{ ...s.empty, borderRadius: 0 }}><p>No audit logs yet.</p></div>}
            </div>
          </div>
        )}

        {/* System Tab */}
        {activeTab === "system" && (
          <div style={s.infoBox}>
            <p style={{ fontWeight: 700, color: "#ffd32a", marginBottom: 12, fontSize: 14 }}>⛓ System Information</p>
            <div style={s.grid2}>
              {[["Smart Contracts", "Ethereum Sepolia Testnet"], ["KYCRegistry", "0x8499045c8cf6502eAe41c0e3e2Fa409A4A8a5Acd"], ["MicroLoanContract", "0x0E48d34E479D7E1e8a983a123C992Da75b764b88"], ["Consensus", "Proof of Stake"], ["Language", "Solidity 0.8.28"], ["Frontend", "React + Web3.js"], ["Backend", "Node.js + Express"], ["Database", "MySQL (Railway)"]].map(([k, v]) => (
                <div key={k} style={s.infoItem}>
                  <span style={{ color: "#4a7090", fontSize: 11, fontFamily: "monospace" }}>{k}</span>
                  <span style={{ color: "#ffd32a", fontFamily: "monospace", fontSize: 12, wordBreak: "break-all" }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   LOAN DETAIL
═══════════════════════════════════════════════════════════════════ */
export function LoanDetail() {
  const { id } = useParams();
  const [loan, setLoan] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const { makeRepaymentOnChain, connected } = useWeb3();
  const { user } = useAuth();

  useEffect(() => {
    const fetchLoan = async () => {
      try {
        const api = (await import("../utils/api")).default;
        const res = await api.get(`/api/loans/${id}`);
        setLoan(res.data.loan);
      } catch (e) { console.error(e); } finally { setIsLoading(false); }
    };
    fetchLoan();
  }, [id]);

  const handleSubmitProof = async (stage) => {
    const billDesc = prompt(`Describe Stage ${stage} bill/invoice:`);
    if (!billDesc) return;
    try {
      const api = (await import("../utils/api")).default;
      await api.post(`/api/milestones/${id}/submit`, { stage, billDescription: billDesc, proofData: billDesc });
      alert("Proof submitted! Awaiting verification.");
      window.location.reload();
    } catch (err) { alert(err.response?.data?.message || err.message); }
  };

  const handleRepay = async (installment, amountWei) => {
    if (!connected) return alert("Connect MetaMask first");
    try {
      const receipt = await makeRepaymentOnChain(loan.loan_id_hash, installment, amountWei);
      const api = (await import("../utils/api")).default;
      await api.post(`/api/repayments/${id}/record`, { installmentNo: installment, txHash: receipt.hash, amountPaidWei: amountWei });
      alert("✅ Repayment successful!");
      window.location.reload();
    } catch (err) { alert(err.message); }
  };

  const s = styles;
  const MILESTONE_LABELS = ["Stage 1 (20%) — Auto on Approval", "Stage 2 (30%) — Bill 1 Submission", "Stage 3 (30%) — Bill 2 Submission", "Stage 4 (20%) — Final Proof"];

  if (isLoading) return <div style={s.page}><p style={{ color: "#4a7090", padding: 40, fontFamily: "monospace" }}>Loading blockchain data...</p></div>;
  if (!loan) return <div style={s.page}><p style={{ color: "#ff4757", padding: 40 }}>Loan not found.</p></div>;

  return (
    <div style={s.page}>
      <div style={{ maxWidth: 860, margin: "0 auto", padding: "28px 20px" }}>
        <Link to="/dashboard" style={{ color: "#4a7090", fontSize: 13, textDecoration: "none" }}>← Back to Dashboard</Link>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12, marginBottom: 24 }}>
          <h1 style={{ ...s.title, margin: 0 }}>Loan #{loan.id}</h1>
          <StatusBadge status={loan.status} />
        </div>
        {loan.milestones?.length > 0 && <MilestoneProgress milestones={loan.milestones} />}
        <div style={s.grid2}>
          {[["Borrower", loan.borrower_name], ["Lender", loan.lender_name || "—"], ["Credit Score", loan.credit_score], ["Tenure", `${loan.tenure_months} months`], ["Applied", new Date(loan.applied_at).toLocaleDateString()], ["Status", loan.status]].map(([k, v]) => (
            <div key={k} style={s.infoItem}>
              <span style={{ color: "#4a7090", fontSize: 11, fontFamily: "monospace", letterSpacing: 1 }}>{k.toUpperCase()}</span>
              <span style={{ color: "#c8e0f4", fontWeight: 600 }}>{v}</span>
            </div>
          ))}
        </div>
        {loan.loan_id_hash && (
          <div style={{ ...s.infoBox, marginBottom: 20 }}>
            <span style={{ color: "#4a7090", fontSize: 11, fontFamily: "monospace" }}>ON-CHAIN LOAN ID:</span>
            <p style={{ fontFamily: "monospace", fontSize: 12, color: "#00d4ff", wordBreak: "break-all", marginTop: 4 }}>{loan.loan_id_hash}</p>
          </div>
        )}
        <h2 style={s.sectionTitle}>Milestone Releases</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {(loan.milestones || []).map((m, i) => (
            <div key={i} style={{ ...s.milestoneCard, borderColor: m.status === "RELEASED" ? "#00ff9f" : m.status === "SUBMITTED" ? "#ffd32a" : "#1a3a5c" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <p style={{ color: "#c8e0f4", fontWeight: 600, fontSize: 14 }}>{MILESTONE_LABELS[i] || `Stage ${i + 1}`}</p>
                  {m.bill_description && <p style={{ color: "#4a7090", fontSize: 12, marginTop: 4 }}>{m.bill_description}</p>}
                  {m.tx_hash && <p style={{ fontSize: 11, fontFamily: "monospace", color: "#00d4ff", marginTop: 4 }}>Tx: {m.tx_hash.slice(0, 20)}...</p>}
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <StatusBadge status={m.status} />
                  {user?.role === "borrower" && m.status === "PENDING" && i > 0 && loan.status === "ACTIVE" && (
                    <button onClick={() => handleSubmitProof(m.stage)} style={s.smallBtn}>Submit Proof</button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
        {loan.repayments?.length > 0 && (
          <>
            <h2 style={s.sectionTitle}>Repayment Schedule</h2>
            <div style={{ ...s.card, padding: 0, overflow: "hidden", margin: 0 }}>
              <table style={s.table}>
                <thead><tr>{["#", "Due Date", "Amount (Wei)", "Status", "Action"].map(h => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
                <tbody>
                  {loan.repayments.map((r, i) => (
                    <tr key={i}>
                      <td style={s.td}>{r.installment_no}</td>
                      <td style={s.td}>{new Date(r.due_date).toLocaleDateString()}</td>
                      <td style={{ ...s.td, fontFamily: "monospace", color: "#4a7090", fontSize: 12 }}>{r.emi_amount_wei}</td>
                      <td style={s.td}><StatusBadge status={r.paid ? "PAID" : "PENDING"} /></td>
                      <td style={s.td}>
                        {!r.paid && user?.role === "borrower" && loan.status === "ACTIVE" && (
                          <button onClick={() => handleRepay(r.installment_no, r.emi_amount_wei)} style={s.smallBtn}>Pay EMI</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   LENDER REVIEW PAGE (standalone /lender route)
═══════════════════════════════════════════════════════════════════ */
export function LenderReview() {
  const { user, logout } = useAuth();
  const { connected, connectWallet } = useWeb3();

  return (
    <div style={styles.page}>
      <Navbar user={user} onLogout={logout} />
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "28px 20px" }}>
        <h1 style={{ ...styles.title, color: "#00ff9f" }}>Pending Loan Requests</h1>
        <p style={styles.subtitle}>Review and approve loan applications on-chain</p>
        {!connected && (
          <div style={{ ...styles.warning, marginBottom: 20 }}>
            ⚠ Connect MetaMask to approve/reject loans.{" "}
            <button onClick={connectWallet} style={{ ...styles.smallBtn, borderColor: "#ffd32a", color: "#ffd32a" }}>Connect Now</button>
          </div>
        )}
        <LenderPendingList />
      </div>
    </div>
  );
}

function LenderPendingList() {
  const [loans, setLoans] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchLoans = async () => {
      try {
        const api = (await import("../utils/api")).default;
        const res = await api.get("/api/loans/pending");
        setLoans(res.data.loans || []);
      } catch (e) { console.error(e); } finally { setIsLoading(false); }
    };
    fetchLoans();
  }, []);

  if (isLoading) return <p style={{ color: "#4a7090", fontFamily: "monospace" }}>Loading...</p>;
  if (loans.length === 0) return <div style={styles.empty}><p>No pending loan requests.</p></div>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {loans.map((loan) => <LenderLoanCard key={loan.id} loan={loan} />)}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   ADMIN PANEL  (fixed: admin role now gets AuditorDashboard with full KYC controls)
═══════════════════════════════════════════════════════════════════ */
export function AdminPanel() {
  const { user, logout } = useAuth();
  if (!user) return null;
  // admin and auditor both need KYC verify/reject capability → AuditorDashboard
  if (user.role === "admin")   return <AuditorDashboard user={user} logout={logout} />;
  if (user.role === "auditor") return <AuditorDashboard user={user} logout={logout} />;
  return <GovernmentDashboard user={user} logout={logout} />;
}

/* ═══════════════════════════════════════════════════════════════════
   AUDIT LOGS PAGE
═══════════════════════════════════════════════════════════════════ */
export function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const { user, logout } = useAuth();

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const api = (await import("../utils/api")).default;
        const res = await api.get("/api/admin/audit-logs");
        setLogs(res.data.logs || []);
      } catch (e) { console.error(e); } finally { setIsLoading(false); }
    };
    fetchLogs();
  }, []);

  const actionColors = {
    KYC_SUBMITTED: "#00d4ff", KYC_VERIFIED: "#00ff9f", KYC_REJECTED: "#ff4757",
    LOAN_APPLIED: "#ffd32a", LOAN_APPROVED: "#00ff9f", LOAN_REJECTED: "#ff4757",
    MILESTONE_RELEASED: "#a78bfa", MILESTONE_SUBMITTED: "#ffd32a",
    REPAYMENT_MADE: "#00ff9f", LOAN_DEFAULTED: "#ff4757", LOAN_COMPLETED: "#00ff9f",
  };

  const filtered = logs.filter((l) => !search || l.action?.includes(search.toUpperCase()) || l.actor_wallet?.includes(search));
  const s = styles;

  return (
    <div style={s.page}>
      <Navbar user={user} onLogout={logout} />
      <div style={{ maxWidth: 1060, margin: "0 auto", padding: "28px 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1 style={{ ...s.title, margin: 0 }}>Audit Logs</h1>
            <p style={s.subtitle}>Immutable Blockchain Transaction Trail</p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input style={{ ...s.input, width: 220, padding: "8px 12px" }} placeholder="Search action or wallet..." value={search} onChange={(e) => setSearch(e.target.value)} />
            <span style={{ ...s.tag, fontSize: 13 }}>{filtered.length} records</span>
          </div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 20 }}>
          {Object.entries(actionColors).map(([action, color]) => (
            <span key={action} style={{ ...s.badge, color, borderColor: color, background: `${color}10`, fontSize: 10 }}>{action}</span>
          ))}
        </div>
        {isLoading ? (
          <p style={{ color: "#4a7090", fontFamily: "monospace" }}>Loading audit trail...</p>
        ) : (
          <div style={{ ...s.card, padding: 0, overflow: "hidden", margin: 0 }}>
            <table style={s.table}>
              <thead><tr>{["Timestamp", "Action", "Actor Wallet", "Loan ID", "Tx Hash"].map(h => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
              <tbody>
                {filtered.map((log) => (
                  <tr key={log.id}>
                    <td style={{ ...s.td, color: "#4a7090", whiteSpace: "nowrap", fontSize: 12 }}>{new Date(log.created_at).toLocaleString()}</td>
                    <td style={s.td}><span style={{ color: actionColors[log.action] || "#c8e0f4", fontFamily: "monospace", fontSize: 11, border: "1px solid currentColor", padding: "2px 6px", borderRadius: 3 }}>{log.action}</span></td>
                    <td style={{ ...s.td, color: "#4a7090", fontFamily: "monospace", fontSize: 11 }}>{log.actor_wallet ? `${log.actor_wallet.slice(0, 10)}...` : "—"}</td>
                    <td style={{ ...s.td, fontFamily: "monospace" }}>{log.loan_id || "—"}</td>
                    <td style={{ ...s.td, color: "#00d4ff", fontFamily: "monospace", fontSize: 11 }}>{log.tx_hash ? `${log.tx_hash.slice(0, 14)}...` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && <div style={{ ...s.empty, borderRadius: 0 }}><p>No audit logs found.</p></div>}
          </div>
        )}
        <div style={{ ...s.infoBox, marginTop: 20 }}>
          <p style={{ margin: 0 }}>🔒 All entries above are cryptographically hashed on Ethereum. No government official or admin can alter these records — ensuring a fully corruption-free lending process.</p>
        </div>
      </div>
    </div>
  );
}