import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
} from "firebase/auth";
import { collection, query, where, getDocs } from "firebase/firestore";
import { auth, db } from "../firebase";
import { AlertCircle, CheckCircle2, Mail, ArrowLeft, Eye, EyeOff, Loader2 } from "lucide-react";

const logo = "/z1-logo.jpeg";

const Auth = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState("login"); // 'login' | 'register' | 'forgot'
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
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

    setSubmitting(true);
    try {
      const isAllowed = await allowedUser(email);
      if (!isAllowed) {
        setError(
          mode === "register"
            ? "Email not pre-approved. Contact an administrator to add your email to the allowed users list."
            : "Access denied. Your email is not authorized for this system."
        );
        return;
      }

      if (mode === "login") {
        await signInWithEmailAndPassword(auth, email, password);
        navigate("/");
      } else if (mode === "register") {
        await createUserWithEmailAndPassword(auth, email, password);
        setMessage("Account created successfully. You can now sign in.");
        setMode("login");
        setPassword("");
      } else if (mode === "forgot") {
        await sendPasswordResetEmail(auth, email);
        setMessage("Password reset email sent. Check your inbox.");
        setMode("login");
      }
    } catch (err) {
      const codeMap = {
        "auth/user-not-found":       "No account found with this email. Try registering first.",
        "auth/email-already-in-use": "An account with this email already exists. Try signing in instead.",
        "auth/wrong-password":       "Incorrect password. Please try again or use 'Forgot Password'.",
        "auth/weak-password":        "Password should be at least 6 characters long.",
        "auth/invalid-email":        "Please enter a valid email address.",
        "auth/too-many-requests":    "Too many failed attempts. Please try again later.",
      };
      setError(codeMap[err.code] || "Authentication error. Please try again.");
      if (!codeMap[err.code]) console.error("Auth error:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const switchMode = (next) => {
    setMode(next);
    setError("");
    setMessage("");
  };

  const submitLabel =
    mode === "login" ? "Sign In"
    : mode === "register" ? "Create Account"
    : "Send Reset Email";

  return (
    <div className="auth-container">
      <div className="auth-card">
        <button
          type="button"
          className="auth-back-btn"
          onClick={() => navigate("/welcome")}
          aria-label="Back to welcome"
        >
          <ArrowLeft size={14} strokeWidth={2.5} />
          <span>Back</span>
        </button>

        <div className="auth-header">
          <img src={logo} alt="Church Logo" className="auth-logo" />
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
            <div className="auth-error" role="alert">
              <AlertCircle size={16} strokeWidth={2.5} className="auth-msg-icon" />
              <span>{error}</span>
            </div>
          )}

          {message && (
            <div className="auth-success" role="status">
              <CheckCircle2 size={16} strokeWidth={2.5} className="auth-msg-icon" />
              <span>{message}</span>
            </div>
          )}

          <form className="auth-form" onSubmit={(e) => { e.preventDefault(); handleAuth(); }}>
            <div className="auth-input-group">
              <label htmlFor="email" className="auth-label">Email Address</label>
              <input
                type="email"
                id="email"
                className="auth-input"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>

            {mode !== "forgot" && (
              <div className="auth-input-group">
                <label htmlFor="password" className="auth-label">Password</label>
                <div className="auth-input-wrap">
                  <input
                    type={showPassword ? "text" : "password"}
                    id="password"
                    className="auth-input auth-input-with-trailing"
                    placeholder={mode === "register" ? "Create a password" : "Enter your password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete={mode === "register" ? "new-password" : "current-password"}
                    required
                  />
                  <button
                    type="button"
                    className="auth-input-trailing-btn"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            )}

            <button type="submit" className="auth-btn" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 size={16} className="auth-btn-spinner" strokeWidth={2.5} />
                  <span>
                    {mode === "login" ? "Signing in…" : mode === "register" ? "Creating account…" : "Sending…"}
                  </span>
                </>
              ) : (
                <span>{submitLabel}</span>
              )}
            </button>
          </form>

          <div className="auth-links">
            {mode === "login" && (
              <>
                <button onClick={() => switchMode("register")} className="auth-link-btn">
                  Need an account? Register here
                </button>
                <button onClick={() => switchMode("forgot")} className="auth-link-btn">
                  Forgot your password?
                </button>
              </>
            )}

            {(mode === "register" || mode === "forgot") && (
              <button onClick={() => switchMode("login")} className="auth-link-btn">
                <ArrowLeft size={12} strokeWidth={2.5} className="icon-inline" style={{ marginRight: '0.3rem' }} />
                Back to Sign In
              </button>
            )}
          </div>

          {mode === "register" && (
            <div className="auth-notice">
              <p className="auth-notice-title">Registration requirements</p>
              <ul className="auth-notice-list">
                <li>Your email must be pre-approved by an administrator</li>
                <li>Password must be at least 6 characters long</li>
                <li>You will create your own password during registration</li>
              </ul>
            </div>
          )}

          {mode === "forgot" && (
            <div className="auth-notice">
              <Mail size={14} className="icon-inline" style={{ marginRight: '0.35rem' }} />
              Enter your email and we'll send a reset link. Check your spam folder if it doesn't arrive in a few minutes.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Auth;
