// frontend2/src/pages/AuditorKYC.jsx
// Auditor-facing KYC review panel — lists pending KYC submissions and allows
// Verify / Reject actions on-chain via KYCRegistry smart contract.

import React, { useState, useEffect, useCallback } from "react";
import { useWeb3 } from "../context/Web3Context";
import { useAuth } from "../context/AuthContext";
import axios from "axios";

const STATUS_LABEL = { 0: "Pending", 1: "Verified", 2: "Rejected" };
const STATUS_COLOR = { 0: "#ffb74d", 1: "#00ff9f", 2: "#ff4757" };

export default function AuditorKYC() {
  const { connected, account, connectWallet, verifyKYCOnChain, rejectKYCOnChain, loading: web3Loading } = useWeb3();
  const { user, token } = useAuth();

  const [submissions, setSubmissions] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [actionState, setActionState] = useState({}); // { [id]: "verifying"|"rejecting"|"done"|"error" }
  const [rejectReason, setRejectReason] = useState({}); // { [id]: string }
  const [showRejectInput, setShowRejectInput] = useState({}); // { [id]: bool }
  const [feedback, setFeedback] = useState({}); // { [id]: { type: "success"|"error", msg } }
  const [filter, setFilter] = useState("pending"); // "all" | "pending" | "verified" | "rejected"

  // ── Fetch KYC submissions from backend ──────────────────────────────────────
  const fetchSubmissions = useCallback(async () => {
    setLoadingList(true);
    try {
      // Use same endpoint as AuditorDashboard in AllPages: /api/kyc/pending
      // For verified/rejected we use /api/kyc/pending?status=filter
      const endpoint = filter === "all" ? "/api/kyc/pending" : `/api/kyc/pending?status=${filter}`;
      const { data } = await axios.get(endpoint, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSubmissions(data?.pending || data?.submissions || data || []);
    } catch (err) {
      console.error("Failed to load KYC submissions:", err);
    } finally {
      setLoadingList(false);
    }
  }, [token, filter]);

  useEffect(() => { fetchSubmissions(); }, [fetchSubmissions]);

  // ── Verify ──────────────────────────────────────────────────────────────────
  const handleVerify = async (submission) => {
    const id = submission._id || submission.id;
    if (!connected) {
      alert("Please connect your MetaMask wallet first.");
      await connectWallet();
      return;
    }

    setActionState(prev => ({ ...prev, [id]: "verifying" }));
    setFeedback(prev => ({ ...prev, [id]: null }));

    try {
      // 1. On-chain verification
      const walletAddr = submission.walletAddress || submission.wallet_address;
      const receipt = await verifyKYCOnChain(walletAddr);

      // 2. Update backend — matches /api/kyc/verify/:userId used in AuditorDashboard
      await axios.post(
        `/api/kyc/verify/${id}`,
        {
          status: "verified",
          walletAddress: submission.walletAddress || submission.wallet_address,
          txHash: receipt.hash || receipt.transactionHash,
          auditorAddress: account,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setActionState(prev => ({ ...prev, [id]: "done" }));
      setFeedback(prev => ({
        ...prev,
        [id]: { type: "success", msg: "KYC Verified on-chain ✅" },
      }));
      // Refresh list
      setTimeout(fetchSubmissions, 1200);
    } catch (err) {
      console.error("Verify error:", err);
      const msg = err?.reason || err?.data?.message || err?.message || "Verification failed.";
      setActionState(prev => ({ ...prev, [id]: "error" }));
      setFeedback(prev => ({ ...prev, [id]: { type: "error", msg } }));
    }
  };

  // ── Reject ───────────────────────────────────────────────────────────────────
  const handleReject = async (submission) => {
    const id = submission._id || submission.id;
    const reason = (rejectReason[id] || "").trim();

    if (!reason) {
      setFeedback(prev => ({ ...prev, [id]: { type: "error", msg: "Please enter a rejection reason." } }));
      return;
    }

    if (!connected) {
      alert("Please connect your MetaMask wallet first.");
      await connectWallet();
      return;
    }

    setActionState(prev => ({ ...prev, [id]: "rejecting" }));
    setFeedback(prev => ({ ...prev, [id]: null }));

    try {
      // 1. On-chain rejection
      const walletAddr = submission.walletAddress || submission.wallet_address;
      const receipt = await rejectKYCOnChain(walletAddr, reason);

      // 2. Update backend — same single endpoint, status drives the action
      await axios.post(
        `/api/kyc/verify/${id}`,
        {
          status: "rejected",
          reason,
          walletAddress: submission.walletAddress || submission.wallet_address,
          txHash: receipt.hash || receipt.transactionHash,
          auditorAddress: account,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setActionState(prev => ({ ...prev, [id]: "done" }));
      setFeedback(prev => ({
        ...prev,
        [id]: { type: "success", msg: "KYC Rejected on-chain ❌" },
      }));
      setShowRejectInput(prev => ({ ...prev, [id]: false }));
      setTimeout(fetchSubmissions, 1200);
    } catch (err) {
      console.error("Reject error:", err);
      const msg = err?.reason || err?.data?.message || err?.message || "Rejection failed.";
      setActionState(prev => ({ ...prev, [id]: "error" }));
      setFeedback(prev => ({ ...prev, [id]: { type: "error", msg } }));
    }
  };

  // ── Guard: only auditor role ─────────────────────────────────────────────────
  if (user?.role !== "auditor") {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <p style={{ color: "#ff4757" }}>Access denied. Auditor role required.</p>
        </div>
      </div>
    );
  }

  // ── UI ───────────────────────────────────────────────────────────────────────
  return (
    <div style={styles.page}>
      <div style={styles.card}>
        {/* Header */}
        <div style={styles.header}>
          <div>
            <h2 style={styles.title}>KYC Verification Panel</h2>
            <p style={styles.subtitle}>Review and verify / reject KYC submissions on-chain</p>
          </div>
          {/* Wallet status */}
          {!connected ? (
            <button style={styles.connectBtn} onClick={connectWallet} disabled={web3Loading}>
              {web3Loading ? "Connecting…" : "🦊 Connect Wallet"}
            </button>
          ) : (
            <span style={styles.walletBadge}>
              🟢 {account?.slice(0, 6)}…{account?.slice(-4)}
            </span>
          )}
        </div>

        {/* Filter tabs */}
        <div style={styles.tabs}>
          {["pending", "verified", "rejected", "all"].map(f => (
            <button
              key={f}
              style={{ ...styles.tab, ...(filter === f ? styles.tabActive : {}) }}
              onClick={() => setFilter(f)}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
          <button style={styles.refreshBtn} onClick={fetchSubmissions} disabled={loadingList}>
            {loadingList ? "Loading…" : "↻ Refresh"}
          </button>
        </div>

        {/* List */}
        {loadingList && <div style={styles.loading}>Loading submissions…</div>}

        {!loadingList && submissions.length === 0 && (
          <div style={styles.empty}>No KYC submissions found for this filter.</div>
        )}

        {submissions.map((sub) => {
          const id    = sub._id || sub.id;
          const state = actionState[id];
          const fb    = feedback[id];
          const isPending = (sub.status === 0 || sub.status === "pending" || sub.kyc_status === "pending");

          return (
            <div key={id} style={styles.submissionCard}>
              {/* Top row */}
              <div style={styles.subHeader}>
                <div>
                  <span style={styles.subName}>{sub.fullName || sub.name || sub.full_name || "Unknown"}</span>
                  <span style={styles.subRole}>{sub.role || sub.userRole}</span>
                </div>
                {(() => {
                  const st = sub.status ?? sub.kyc_status ?? "pending";
                  const numericMap = { "pending": 0, "verified": 1, "rejected": 2 };
                  const idx = typeof st === "number" ? st : (numericMap[st] ?? 0);
                  return (
                    <span style={{
                      ...styles.statusBadge,
                      color: STATUS_COLOR[idx] || "#ffb74d",
                      borderColor: STATUS_COLOR[idx] || "#ffb74d",
                    }}>
                      {STATUS_LABEL[idx] || st || "Pending"}
                    </span>
                  );
                })()}
              </div>

              {/* Details */}
              <div style={styles.detailsGrid}>
                <Detail label="Email"        value={sub.email} />
                <Detail label="Wallet"       value={(sub.walletAddress || sub.wallet_address) ? `${(sub.walletAddress || sub.wallet_address).slice(0,8)}…${(sub.walletAddress || sub.wallet_address).slice(-6)}` : "—"} />
                <Detail label="Aadhaar"      value={sub.aadhaarNumber || sub.aadhaar_number || sub.aadhaar || "—"} />
                <Detail label="PAN"          value={sub.panNumber || sub.pan_number || sub.pan || "—"} />
                <Detail label="GST"          value={sub.gstNumber || sub.gst_number || "—"} />
                <Detail label="Business"     value={sub.businessName || sub.business_name || "—"} />
                <Detail label="Type"         value={sub.businessType || sub.business_type || "—"} />
                <Detail label="Turnover"     value={(sub.annualTurnover || sub.annual_turnover) ? `₹${Number(sub.annualTurnover || sub.annual_turnover).toLocaleString()}` : "—"} />
                <Detail label="Submitted"    value={(sub.createdAt || sub.created_at) ? new Date(sub.createdAt || sub.created_at).toLocaleDateString() : "—"} />
              </div>

              {/* KYC document links */}
              {(sub.documents || sub.kycDocuments) && (
                <div style={styles.docRow}>
                  {(sub.documents || sub.kycDocuments).map((doc, i) => (
                    <a key={i} href={doc.url || doc} target="_blank" rel="noreferrer" style={styles.docLink}>
                      📄 Document {i + 1}
                    </a>
                  ))}
                </div>
              )}

              {/* Feedback message */}
              {fb && (
                <div style={{
                  ...styles.feedbackBox,
                  borderColor: fb.type === "success" ? "#00ff9f" : "#ff4757",
                  color:       fb.type === "success" ? "#00ff9f" : "#ff6b81",
                  background:  fb.type === "success" ? "rgba(0,255,159,0.07)" : "rgba(255,71,87,0.08)",
                }}>
                  {fb.msg}
                </div>
              )}

              {/* Action buttons — only for pending and auditor */}
              {isPending && state !== "done" && (
                <div style={styles.actionRow}>
                  {/* ✅ VERIFY BUTTON */}
                  <button
                    style={styles.verifyBtn}
                    onClick={() => handleVerify(sub)}
                    disabled={state === "verifying" || state === "rejecting"}
                  >
                    {state === "verifying" ? "Verifying…" : "✅ Verify KYC"}
                  </button>

                  {/* ❌ REJECT BUTTON */}
                  {!showRejectInput[id] ? (
                    <button
                      style={styles.rejectBtn}
                      onClick={() => setShowRejectInput(prev => ({ ...prev, [id]: true }))}
                      disabled={state === "verifying" || state === "rejecting"}
                    >
                      ❌ Reject
                    </button>
                  ) : (
                    <div style={styles.rejectGroup}>
                      <input
                        style={styles.rejectInput}
                        placeholder="Reason for rejection…"
                        value={rejectReason[id] || ""}
                        onChange={e => setRejectReason(prev => ({ ...prev, [id]: e.target.value }))}
                      />
                      <button
                        style={styles.rejectConfirmBtn}
                        onClick={() => handleReject(sub)}
                        disabled={state === "rejecting"}
                      >
                        {state === "rejecting" ? "Rejecting…" : "Confirm Reject"}
                      </button>
                      <button
                        style={styles.cancelBtn}
                        onClick={() => setShowRejectInput(prev => ({ ...prev, [id]: false }))}
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Detail({ label, value }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span style={{ color: "#4a7090", fontSize: 11 }}>{label}</span>
      <span style={{ color: "#c8e0f4", fontSize: 13 }}>{value || "—"}</span>
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────────
const styles = {
  page:      { minHeight: "100vh", background: "#070f1a", padding: "32px 16px" },
  card:      { background: "#0c1829", border: "1px solid #1a3a5c", borderRadius: 12, padding: "28px 32px", maxWidth: 900, margin: "0 auto" },
  header:    { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 },
  title:     { color: "#00d4ff", fontFamily: "Rajdhani,sans-serif", fontSize: 22, fontWeight: 700, margin: 0 },
  subtitle:  { color: "#4a7090", fontSize: 13, marginTop: 4 },
  connectBtn:{ background: "rgba(0,212,255,0.1)", border: "1px solid #00d4ff", color: "#00d4ff", borderRadius: 6, padding: "8px 16px", cursor: "pointer", fontSize: 13 },
  walletBadge:{ fontFamily: "monospace", color: "#00ff9f", fontSize: 13, padding: "8px 12px", background: "rgba(0,255,159,0.07)", border: "1px solid #00ff9f", borderRadius: 6 },
  tabs:      { display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" },
  tab:       { background: "transparent", border: "1px solid #1a3a5c", color: "#4a7090", borderRadius: 5, padding: "6px 16px", cursor: "pointer", fontSize: 13 },
  tabActive: { background: "rgba(0,212,255,0.1)", borderColor: "#00d4ff", color: "#00d4ff" },
  refreshBtn:{ marginLeft: "auto", background: "transparent", border: "1px solid #1a3a5c", color: "#8ab4cc", borderRadius: 5, padding: "6px 14px", cursor: "pointer", fontSize: 13 },
  loading:   { color: "#4a7090", textAlign: "center", padding: 24 },
  empty:     { color: "#4a7090", textAlign: "center", padding: 24, border: "1px dashed #1a3a5c", borderRadius: 8 },
  submissionCard: { background: "#070f1a", border: "1px solid #1a3a5c", borderRadius: 9, padding: "18px 20px", marginBottom: 16 },
  subHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  subName:   { color: "#c8e0f4", fontWeight: 700, fontSize: 15, marginRight: 8 },
  subRole:   { background: "rgba(0,212,255,0.08)", border: "1px solid #00d4ff", color: "#00d4ff", fontSize: 10, padding: "2px 8px", borderRadius: 3, fontFamily: "monospace" },
  statusBadge:{ fontSize: 11, padding: "3px 10px", borderRadius: 3, border: "1px solid", fontWeight: 700 },
  detailsGrid:{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px 20px", marginBottom: 12 },
  docRow:    { display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap" },
  docLink:   { color: "#00d4ff", fontSize: 12, textDecoration: "none" },
  feedbackBox:{ borderRadius: 6, padding: "9px 14px", fontSize: 13, border: "1px solid", marginBottom: 10 },
  actionRow: { display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-start" },
  verifyBtn: { background: "rgba(0,255,159,0.12)", border: "1px solid #00ff9f", color: "#00ff9f", borderRadius: 6, padding: "9px 20px", cursor: "pointer", fontWeight: 700, fontSize: 13 },
  rejectBtn: { background: "rgba(255,71,87,0.1)", border: "1px solid #ff4757", color: "#ff4757", borderRadius: 6, padding: "9px 20px", cursor: "pointer", fontWeight: 700, fontSize: 13 },
  rejectGroup:{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" },
  rejectInput:{ background: "#0a1525", border: "1px solid #ff4757", color: "#c8e0f4", borderRadius: 5, padding: "8px 12px", fontSize: 13, minWidth: 220 },
  rejectConfirmBtn:{ background: "rgba(255,71,87,0.15)", border: "1px solid #ff4757", color: "#ff4757", borderRadius: 5, padding: "8px 14px", cursor: "pointer", fontSize: 13, fontWeight: 700 },
  cancelBtn: { background: "transparent", border: "1px solid #1a3a5c", color: "#4a7090", borderRadius: 5, padding: "8px 12px", cursor: "pointer", fontSize: 13 },
};
