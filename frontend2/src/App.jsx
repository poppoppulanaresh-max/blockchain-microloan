// frontend/src/App.jsx
import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth }  from "./context/AuthContext";
import { Web3Provider }           from "./context/Web3Context";

// Pages
import Login         from "./pages/Login";
import Register      from "./pages/Register";
import Dashboard     from "./pages/Dashboard";
import ApplyLoan     from "./pages/ApplyLoan";
import LoanDetail    from "./pages/LoanDetail";
import LenderReview  from "./pages/LenderReview";
import KYCSubmit     from "./pages/KYCSubmit";
import AdminPanel    from "./pages/AdminPanel";
import AuditLogs     from "./pages/AuditLogs";
import Navbar        from "./components/Navbar";

// ── Protected Route ────────────────────────────────────
function PrivateRoute({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading">Loading...</div>;
  if (!user)   return <Navigate to="/login" />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" />;
  return children;
}

function AppRoutes() {
  const { user } = useAuth();
  return (
    <>
      {user && <Navbar />}
      <div className="main-content">
        <Routes>
          <Route path="/login"    element={<Login />} />
          <Route path="/register" element={<Register />} />

          <Route path="/dashboard" element={
            <PrivateRoute><Dashboard /></PrivateRoute>
          }/>
          <Route path="/kyc" element={
            <PrivateRoute><KYCSubmit /></PrivateRoute>
          }/>
          <Route path="/loans/apply" element={
            <PrivateRoute roles={["borrower"]}><ApplyLoan /></PrivateRoute>
          }/>
          <Route path="/loans/:id" element={
            <PrivateRoute><LoanDetail /></PrivateRoute>
          }/>
          <Route path="/lender/review" element={
            <PrivateRoute roles={["lender"]}><LenderReview /></PrivateRoute>
          }/>
          <Route path="/admin" element={
            <PrivateRoute roles={["admin"]}><AdminPanel /></PrivateRoute>
          }/>
          <Route path="/audit-logs" element={
            <PrivateRoute roles={["admin","auditor","government"]}><AuditLogs /></PrivateRoute>
          }/>
          <Route path="/" element={<Navigate to="/dashboard" />} />
        </Routes>
      </div>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Web3Provider>
          <AppRoutes />
        </Web3Provider>
      </AuthProvider>
    </BrowserRouter>
  );
}
