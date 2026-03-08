export const connectWallet = async () => {

  if (!window.ethereum) {
    alert("Please install MetaMask");
    return;
  }

  const accounts = await window.ethereum.request({
    method: "eth_requestAccounts",
  });

  return accounts[0];
};