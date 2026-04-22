import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from "lucide-react";

const ToastContext = createContext(null);

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
};

// Global handle so non-component modules (e.g. reportGenerator) can show toasts.
// The ToastProvider assigns this on mount.
let globalToast = null;
export const toast = {
  success: (m, d) => globalToast?.success(m, d),
  error:   (m, d) => globalToast?.error(m, d),
  info:    (m, d) => globalToast?.info(m, d),
  warn:    (m, d) => globalToast?.warn(m, d),
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((ts) => ts.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((message, type, duration) => {
    const id = ++idRef.current;
    setToasts((ts) => [...ts, { id, message, type }]);
    if (duration > 0) {
      setTimeout(() => dismiss(id), duration);
    }
    return id;
  }, [dismiss]);

  const api = useMemo(() => ({
    success: (m, d = 4000) => push(m, "success", d),
    error:   (m, d = 6000) => push(m, "error", d),
    info:    (m, d = 4000) => push(m, "info", d),
    warn:    (m, d = 5000) => push(m, "warn", d),
    dismiss,
  }), [push, dismiss]);

  useEffect(() => {
    globalToast = api;
    return () => { if (globalToast === api) globalToast = null; };
  }, [api]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-container" role="region" aria-live="polite" aria-label="Notifications">
        {toasts.map((t) => {
          const Icon =
            t.type === "success" ? CheckCircle2
            : t.type === "error" ? AlertCircle
            : t.type === "warn" ? AlertTriangle
            : Info;
          return (
            <div key={t.id} className={`toast toast-${t.type}`} role="status">
              <span className="toast-icon" aria-hidden="true">
                <Icon size={18} strokeWidth={2.5} />
              </span>
              <span className="toast-msg">{t.message}</span>
              <button
                type="button"
                className="toast-close"
                aria-label="Dismiss notification"
                onClick={() => dismiss(t.id)}
              >
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
