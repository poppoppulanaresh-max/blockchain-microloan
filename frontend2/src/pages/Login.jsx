import React, { useState } from "react";
import api from "../utils/api";
import { useNavigate } from "react-router-dom";

export default function Login() {

  const navigate = useNavigate();

  const [form, setForm] = useState({
    email: "",
    password: ""
  });

  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {

      setLoading(true);

      const res = await api.post("/api/auth/login", form);

      localStorage.setItem("token", res.data.token);

      alert("Login successful");

      navigate("/dashboard");

    } catch (error) {

      console.error(error);

      alert(
        error?.response?.data?.message || "Login failed"
      );

    } finally {

      setLoading(false);

    }
  };

  return (
    <div className="auth-container">

      <h2>Login</h2>

      <form onSubmit={handleSubmit}>

        <input
          type="email"
          name="email"
          placeholder="Email"
          value={form.email}
          onChange={handleChange}
          required
        />

        <input
          type="password"
          name="password"
          placeholder="Password"
          value={form.password}
          onChange={handleChange}
          required
        />

        <button type="submit" disabled={loading}>
          {loading ? "Logging in..." : "Login"}
        </button>

      </form>

    </div>
  );
}