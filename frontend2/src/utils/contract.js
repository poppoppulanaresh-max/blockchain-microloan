import { ethers } from "ethers";
import LoanABI from "../contracts/LoanABI.json";

const contractAddress = process.env.REACT_APP_CONTRACT_ADDRESS;

export const getContract = async () => {

  if (!window.ethereum) {
    alert("Please install MetaMask");
    return;
  }

  const provider = new ethers.BrowserProvider(window.ethereum);

  const signer = await provider.getSigner();

  const contract = new ethers.Contract(
    contractAddress,
    LoanABI,
    signer
  );

  return contract;
};