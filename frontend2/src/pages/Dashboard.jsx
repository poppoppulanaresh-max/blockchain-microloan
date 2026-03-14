import { Link } from "react-router-dom";

export default function Dashboard() {
  return (
    <div>
      <h2>User Dashboard</h2>

      <ul>
        <li><Link to="/apply-loan">Apply Loan</Link></li>
        <li><Link to="/kyc">Submit KYC</Link></li>
        <li><Link to="/audit">Audit Logs</Link></li>
      </ul>
    </div>
  );
}