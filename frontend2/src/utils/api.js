import axios from "axios";

const api = axios.create({
  baseURL: process.env.REACT_APP_BACKEND_URL || "https://blockchain-microloan.onrender.com",
  headers: {
    "Content-Type": "application/json"
  }
});

// Attach JWT token automatically
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

export default api;