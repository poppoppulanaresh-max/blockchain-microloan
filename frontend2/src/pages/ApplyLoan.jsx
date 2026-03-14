import { useState } from "react";
import api from "../utils/api";

export default function ApplyLoan() {

  const [amount, setAmount] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      await api.post("/loans/apply", { amount });
      alert("Loan application submitted");
    } catch {
      alert("Failed to apply loan");
    }
  };

  return (
    <div>
      <h2>Apply Loan</h2>

      <form onSubmit={handleSubmit}>
        <input
          type="number"
          placeholder="Loan Amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />

        <button type="submit">Apply</button>
      </form>
    </div>
  );
}