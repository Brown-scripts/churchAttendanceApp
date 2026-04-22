import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";

const ConfirmContext = createContext(null);

export const useConfirm = () => {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used inside <ConfirmProvider>");
  return ctx;
};

export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null);
  const resolverRef = useRef(null);

  const confirm = useCallback((opts = {}) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setState({
        title: opts.title || "Are you sure?",
        message: opts.message || "",
        confirmLabel: opts.confirmLabel || "Confirm",
        cancelLabel: opts.cancelLabel || "Cancel",
        variant: opts.variant || "default", // "default" | "danger"
      });
    });
  }, []);

  const settle = (result) => {
    if (resolverRef.current) {
      resolverRef.current(result);
      resolverRef.current = null;
    }
    setState(null);
  };

  // Esc closes; Enter confirms
  useEffect(() => {
    if (!state) return;
    const onKey = (e) => {
      if (e.key === "Escape") { e.preventDefault(); settle(false); }
      else if (e.key === "Enter") { e.preventDefault(); settle(true); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <div className="modal-overlay" onClick={() => settle(false)}>
          <div
            className="modal-content confirm-dialog"
            onClick={(e) => e.stopPropagation()}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
          >
            <div className="confirm-body">
              <div className={`confirm-icon confirm-icon-${state.variant}`}>
                <AlertTriangle size={22} strokeWidth={2.25} />
              </div>
              <div className="confirm-text">
                <h3 id="confirm-title" className="confirm-title">{state.title}</h3>
                {state.message && <p className="confirm-message">{state.message}</p>}
              </div>
            </div>
            <div className="modal-buttons">
              <button type="button" className="btn-secondary" onClick={() => settle(false)} autoFocus>
                {state.cancelLabel}
              </button>
              <button
                type="button"
                className={state.variant === "danger" ? "btn-danger" : "btn-primary"}
                onClick={() => settle(true)}
              >
                {state.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
