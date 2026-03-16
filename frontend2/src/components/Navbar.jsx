// frontend/src/components/Navbar.jsx
import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth }  from "../context/AuthContext";
import { useWeb3 }  from "../context/Web3Context";

export default function Navbar() {
  const { user, logout }    = useAuth();
  const { account, connected, connectWallet } = useWeb3();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate("/login"); };

  const short = (addr) => addr ? `${addr.slice(0,6)}...${addr.slice(-4)}` : "";

  const navLinks = {
    borrower: [
      { to: "/dashboard",   label: "Dashboard" },
      { to: "/kyc",         label: "KYC" },
      { to: "/loans/apply", label: "Apply Loan" }
    ],
    lender: [
      { to: "/dashboard",     label: "Dashboard" },
      { to: "/kyc",           label: "KYC" },
      { to: "/lender",        label: "Review Loans" }
    ],
    admin: [
      { to: "/dashboard",  label: "Dashboard" },
      { to: "/admin",      label: "Admin Panel" },
      { to: "/audit",      label: "Audit Logs" }
    ],
    auditor: [
      { to: "/dashboard",  label: "Dashboard" },
      { to: "/admin",      label: "KYC Verify" },
      { to: "/audit",      label: "Audit Logs" }
    ],
    government: [
      { to: "/dashboard",  label: "Dashboard" },
      { to: "/admin",      label: "Admin Panel" },
      { to: "/audit",      label: "Audit Logs" }
    ]
  };

  const links = navLinks[user?.role] || [];

  return (
    <nav style={styles.nav}>
      <div style={styles.brand}>
        <span style={styles.logo}>⛓</span>
        <span style={styles.brandText}>MicroLoan</span>
        <span style={styles.badge}>{user?.role?.toUpperCase()}</span>
      </div>

      <div style={styles.links}>
        {links.map(l => (
          <Link key={l.to} to={l.to} style={styles.link}>{l.label}</Link>
        ))}
      </div>

      <div style={styles.right}>
        {!connected ? (
          <button onClick={connectWallet} style={styles.connectBtn}>
            🦊 Connect MetaMask
          </button>
        ) : (
          <span style={styles.wallet}>🦊 {short(account)}</span>
        )}
        <span style={styles.userName}>{user?.name}</span>
        <button onClick={handleLogout} style={styles.logoutBtn}>Logout</button>
      </div>
    </nav>
  );
}

const styles = {
  nav: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    background: "#0c1829", borderBottom: "1px solid #1a3a5c",
    padding: "0 24px", height: 56, position: "sticky", top: 0, zIndex: 100
  },
  brand: { display: "flex", alignItems: "center", gap: 8 },
  logo:  { fontSize: 22 },
  brandText: { fontFamily: "Rajdhani,sans-serif", fontWeight: 700, color: "#00d4ff", fontSize: 18 },
  badge: {
    background: "rgba(0,212,255,0.1)", border: "1px solid #00d4ff",
    color: "#00d4ff", fontSize: 10, padding: "2px 8px", borderRadius: 3,
    fontFamily: "monospace", letterSpacing: 1
  },
  links: { display: "flex", gap: 4 },
  link:  {
    color: "#4a7090", textDecoration: "none", padding: "6px 14px",
    borderRadius: 4, fontSize: 14, transition: "color .2s"
  },
  right:      { display: "flex", alignItems: "center", gap: 12 },
  connectBtn: {
    background: "rgba(0,212,255,0.1)", border: "1px solid #00d4ff",
    color: "#00d4ff", padding: "6px 14px", borderRadius: 5, cursor: "pointer", fontSize: 13
  },
  wallet:  { fontFamily: "monospace", color: "#00ff9f", fontSize: 13 },
  userName: { color: "#c8e0f4", fontSize: 13 },
  logoutBtn: {
    background: "rgba(255,71,87,0.1)", border: "1px solid #ff4757",
    color: "#ff4757", padding: "5px 12px", borderRadius: 5, cursor: "pointer", fontSize: 13
  }
};
