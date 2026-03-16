import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { Web3Provider } from "./context/Web3Context";
import Navbar from "./components/Navbar";

import {
  Login,
  Register,
  Dashboard,
  ApplyLoan,
  LoanDetail,
  LenderReview,
  KYCSubmit,
  AdminPanel,
  AuditLogs,
} from "./pages/AllPages";

function PrivateRoute({ children, roles }) {
  const { user, loading } = useAuth();

  if (loading)
    return <div style={{ color: "#4a7090", padding: 40 }}>Loading...</div>;

  if (!user) return <Navigate to="/login" />;

  if (roles && !roles.includes(user.role))
    return <Navigate to="/dashboard" />;

  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route
        path="/dashboard"
        element={
          <PrivateRoute>
            <Dashboard />
          </PrivateRoute>
        }
      />

      <Route
        path="/kyc"
        element={
          <PrivateRoute>
            <KYCSubmit />
          </PrivateRoute>
        }
      />

      <Route
        path="/loans/apply"
        element={
          <PrivateRoute roles={["borrower"]}>
            <ApplyLoan />
          </PrivateRoute>
        }
      />

      <Route
        path="/loans/:id"
        element={
          <PrivateRoute>
            <LoanDetail />
          </PrivateRoute>
        }
      />

      <Route
        path="/lender"
        element={
          <PrivateRoute roles={["lender"]}>
            <LenderReview />
          </PrivateRoute>
        }
      />

      <Route
        path="/admin"
        element={
          <PrivateRoute roles={["auditor", "government"]}>
            <AdminPanel />
          </PrivateRoute>
        }
      />

      <Route
        path="/audit"
        element={
          <PrivateRoute roles={["auditor", "government"]}>
            <AuditLogs />
          </PrivateRoute>
        }
      />

      <Route path="/" element={<Navigate to="/dashboard" />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Web3Provider>

          {/* Navbar added here */}
          <Navbar />

          <AppRoutes />

        </Web3Provider>
      </AuthProvider>
    </BrowserRouter>
  );
}