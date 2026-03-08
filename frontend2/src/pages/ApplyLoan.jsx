import React, { useState } from "react";
import axios from "axios";
import { getContract } from "../utils/contract";

export default function ApplyLoan() {

  const [amount, setAmount] = useState("");

  const handleApply = async () => {

    try {

      const contract = await getContract();

      const tx = await contract.requestLoan(amount);

      await tx.wait();

      await axios.post(
        process.env.REACT_APP_BACKEND_URL + "/api/loans",
        { amount }
      );

      alert("Loan requested successfully");

    } catch (error) {
      console.error(error);
    }

  };

  return (
    <div>
      <h2>Apply Loan</h2>

      <input
        type="number"
        placeholder="Loan Amount"
        value={amount}
        onChange={(e)=>setAmount(e.target.value)}
      />

      <button onClick={handleApply}>
        Apply Loan
      </button>

    </div>
  );
}
