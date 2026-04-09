import axios from "axios";

const api = axios.create({
  baseURL:
    process.env.REACT_APP_BACKEND_URL ||
    "https://blockchain-microloan.onrender.com",
  headers: {
    "Content-Type": "application/json",
  },
});

// ✅ Attach JWT token automatically
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

// 🔥 ADD THIS (VERY IMPORTANT)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      "Something went wrong";

    console.error("API ERROR:", message);

    return Promise.reject(new Error(message));
  }
);

export default api;