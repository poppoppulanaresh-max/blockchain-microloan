import React from "react";
import { getContract } from "../utils/contract";

const LoanForm = () => {

  const requestLoan = async () => {

    try {

      const contract = await getContract();

      const tx = await contract.requestLoan(1000);

      await tx.wait();

      alert("Loan requested successfully");

    } catch (error) {
      console.error(error);
    }

  };

  return (
    <div>
      <h2>Request Loan</h2>
      <button onClick={requestLoan}>
        Request 1000 Loan
      </button>
    </div>
  );
};

export default LoanForm;