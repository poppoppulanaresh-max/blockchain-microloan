// frontend/src/pages/Login.jsx
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const [form, setForm]     = useState({ email: "", password: "" });
  const [error, setError]   = useState("");
  const [loading, setLoading] = useState(false);
  const { login }   = useAuth();
  const navigate    = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError("");
    try {
      await login(form.email, form.password);
      navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.message || "Login failed");
    } finally { setLoading(false); }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.header}>
          <span style={{ fontSize: 40 }}>â›“</span>
          <h1 style={styles.title}>MicroLoan Platform</h1>
          <p style={styles.sub}>Blockchain-Based Decentralized Finance for MSMEs</p>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>Email</label>
            <input
              type="email" required style={styles.input}
              value={form.email}
              onChange={e => setForm(p => ({...p, email: e.target.value}))}
              placeholder="your@email.com"
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Password</label>
            <input
              type="password" required style={styles.input}
              value={form.password}
              onChange={e => setForm(p => ({...p, password: e.target.value}))}
              placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
            />
          </div>

          {error && <div style={styles.error}>{error}</div>}

          <button type="submit" style={styles.btn} disabled={loading}>
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p style={styles.footer}>
          No account? <Link to="/register" style={{ color: "#00d4ff" }}>Register here</Link>
        </p>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh", background: "#060d1a",
    display: "flex", alignItems: "center", justifyContent: "center",
    backgroundImage: "linear-gradient(rgba(0,212,255,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(0,212,255,0.03) 1px,transparent 1px)",
    backgroundSize: "40px 40px"
  },
  card: {
    background: "#0c1829", border: "1px solid #1a3a5c",
    borderRadius: 12, padding: "40px 36px", width: "100%", maxWidth: 420,
    boxShadow: "0 0 40px rgba(0,212,255,0.08)"
  },
  header: { textAlign: "center", marginBottom: 28 },
  title: { fontFamily: "Rajdhani,sans-serif", color: "#00d4ff", fontSize: 26, marginTop: 8, fontWeight: 700 },
  sub: { color: "#4a7090", fontSize: 13, marginTop: 4 },
  form: { display: "flex", flexDirection: "column", gap: 16 },
  field: { display: "flex", flexDirection: "column", gap: 6 },
  label: { color: "#4a7090", fontSize: 13, fontFamily: "monospace", letterSpacing: 1 },
  input: {
    background: "#060d1a", border: "1px solid #1a3a5c", borderRadius: 6,
    color: "#c8e0f4", padding: "10px 14px", fontSize: 14,
    outline: "none", transition: "border .2s"
  },
  error: { background: "rgba(255,71,87,0.1)", border: "1px solid #ff4757", color: "#ff4757", padding: "8px 12px", borderRadius: 5, fontSize: 13 },
  btn: {
    background: "linear-gradient(135deg,#00d4ff,#0099cc)", border: "none",
    color: "#060d1a", fontWeight: 700, padding: "12px", borderRadius: 6,
    cursor: "pointer", fontSize: 15, marginTop: 4, fontFamily: "Rajdhani,sans-serif", letterSpacing: 1
  },
  footer: { textAlign: "center", color: "#4a7090", fontSize: 13, marginTop: 20 }
};

