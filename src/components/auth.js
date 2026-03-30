import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
} from "firebase/auth";
import { collection, query, where, getDocs } from "firebase/firestore";
import { auth, db } from "../firebase";

const Auth = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState("login"); // 'login' | 'register' | 'forgot'
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  const allowedUser = async (email) => {
    const q = query(
      collection(db, "allowedUsers"),
      where("email", "==", email.trim().toLowerCase())
    );
    const snapshot = await getDocs(q);
    return !snapshot.empty;
  };

  const handleAuth = async () => {
    setError("");
    setMessage("");

    if (!email) {
      setError("Please enter your email address.");
      return;
    }

    if (mode !== "forgot" && !password) {
      setError("Please enter your password.");
      return;
    }

    if (mode === "register" && password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    try {
      const isAllowed = await allowedUser(email);
      if (!isAllowed) {
        if (mode === "register") {
          setError("❌ Email not pre-approved. Contact an administrator to add your email to the allowed users list.");
        } else {
          setError("❌ Access denied. Your email is not authorized for this system.");
        }
        return;
      }

      if (mode === "login") {
        await signInWithEmailAndPassword(auth, email, password);
        navigate("/");
      } else if (mode === "register") {
        await createUserWithEmailAndPassword(auth, email, password);
        setMessage("✅ Account created successfully! You can now log in.");
        setMode("login");
        setPassword(""); // Clear password for security
      } else if (mode === "forgot") {
        await sendPasswordResetEmail(auth, email);
        setMessage("📩 Password reset email sent.");
        setMode("login");
      }
    } catch (err) {
      if (err.code === "auth/user-not-found") {
        setError("❌ No account found with this email. Try registering first.");
      } else if (err.code === "auth/email-already-in-use") {
        setError("❌ An account with this email already exists. Try logging in instead.");
      } else if (err.code === "auth/wrong-password") {
        setError("❌ Incorrect password. Please try again or use 'Forgot Password'.");
      } else if (err.code === "auth/weak-password") {
        setError("❌ Password should be at least 6 characters long.");
      } else if (err.code === "auth/invalid-email") {
        setError("❌ Please enter a valid email address.");
      } else if (err.code === "auth/too-many-requests") {
        setError("❌ Too many failed attempts. Please try again later.");
      } else {
        setError("❌ Authentication error. Please try again.");
        console.error("Auth error:", err);
      }
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h1 className="auth-title">
            {mode === "login"
              ? "Welcome Back"
              : mode === "register"
              ? "Create Account"
              : "Reset Password"}
          </h1>
          <p className="auth-subtitle">
            {mode === "login"
              ? "Sign in to your account"
              : mode === "register"
              ? "Only pre-approved emails can register"
              : "Enter your email to receive a reset link"}
          </p>
        </div>

        <div className="auth-body">
          {error && (
            <div className="auth-error">
              <span>{error}</span>
            </div>
          )}

          {message && (
            <div className="success-banner">
              <span>{message}</span>
            </div>
          )}

          <form className="auth-form" onSubmit={(e) => { e.preventDefault(); handleAuth(); }}>
            <div className="auth-input-group">
              <label htmlFor="email" className="auth-label">
                Email Address
              </label>
              <input
                type="email"
                id="email"
                className="auth-input"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            {mode !== "forgot" && (
              <div className="auth-input-group">
                <label htmlFor="password" className="auth-label">
                  Password
                </label>
                <input
                  type="password"
                  id="password"
                  className="auth-input"
                  placeholder={mode === "register" ? "Create a password" : "Enter your password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            )}

            <button type="submit" className="auth-btn">
              {mode === "login"
                ? "Sign In"
                : mode === "register"
                ? "Create Account"
                : "Send Reset Email"}
            </button>
          </form>

          <div className="auth-links">
          {mode === "login" && (
            <>
              <button
                onClick={() => setMode("register")}
                className="auth-link-btn"
              >
                Need an account? Register here
              </button>
              <button
                onClick={() => setMode("forgot")}
                className="auth-link-btn"
              >
                Forgot your password?
              </button>
            </>
          )}

          {(mode === "register" || mode === "forgot") && (
            <button
              onClick={() => setMode("login")}
              className="auth-link-btn"
            >
              ← Back to Login
            </button>
          )}
        </div>

          {mode === "register" && (
            <div className="auth-notice">
              <p>
                <strong>Registration Requirements:</strong>
              </p>
              <ul style={{ margin: "0.5rem 0 0 1rem", paddingLeft: 0 }}>
                <li>Your email must be pre-approved by an administrator</li>
                <li>Password must be at least 6 characters long</li>
                <li>You will create your own password during registration</li>
              </ul>
              <p style={{ marginTop: "0.75rem" }}>
                If your email is not approved, please contact your administrator to add it to the system.
              </p>
            </div>
          )}

          {mode === "forgot" && (
            <div className="auth-notice">
              <p>
                <strong>Password Reset:</strong> Enter your email address and we'll send you a link to reset your password.
                Make sure to check your spam folder if you don't see the email.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Auth;
