import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { auth } from "../firebase"; // Ensure Firebase is set up correctly
import "./login.css";

// List of allowed users
const allowedEmails = ["admin@example.com", "manager@example.com", "user@example.com"];

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    if (!allowedEmails.includes(email)) {
      setError("You are not authorized to access this system.");
      return;
    }

    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate("/"); // Redirect to Home after login
    } catch (err) {
      setError("Invalid email or password.");
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/login"); // Redirect back to login after logout
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h2 className="login-title">Login</h2>
        {error && <p className="error-message">{error}</p>}
        <form onSubmit={handleLogin} className="login-form">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="login-input"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="login-input"
          />
          <div className="button-group">
            <button type="submit" className="login-button">Login</button>
            <button onClick={() => navigate("/")} className="home-button">Home</button>
          </div>
        </form>
      </div>
    </div>
  );
}
