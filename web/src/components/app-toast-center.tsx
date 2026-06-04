"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/cn";

type AppToastTone = "success" | "error" | "info" | "warning";

type AppToastInput = {
  message: string;
  title?: string;
  tone?: AppToastTone;
};

type AppToastItem = AppToastInput & {
  id: string;
};

type AppToastContextValue = {
  pushToast: (toast: AppToastInput) => void;
};

const APP_TOAST_MAX_ITEMS = 5;
const APP_TOAST_VISIBLE_MS = 4_200;
const APP_TOAST_EXIT_MS = 420;

const AppToastContext = createContext<AppToastContextValue | null>(null);

export function AppToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<AppToastItem[]>([]);
  const timeoutMapRef = useRef<Map<string, number>>(new Map());

  const dismissToast = useCallback((toastId: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== toastId));
    const timeoutId = timeoutMapRef.current.get(toastId);
    if (timeoutId) {
      window.clearTimeout(timeoutId);
      timeoutMapRef.current.delete(toastId);
    }
  }, []);

  const pushToast = useCallback((toast: AppToastInput) => {
    const id = crypto.randomUUID();
    setToasts((current) => [...current.slice(-(APP_TOAST_MAX_ITEMS - 1)), { id, tone: "info", ...toast }]);
    const timeoutId = window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
      timeoutMapRef.current.delete(id);
    }, APP_TOAST_VISIBLE_MS + APP_TOAST_EXIT_MS);
    timeoutMapRef.current.set(id, timeoutId);
  }, []);

  useEffect(() => {
    return () => {
      for (const timeoutId of timeoutMapRef.current.values()) {
        window.clearTimeout(timeoutId);
      }
      timeoutMapRef.current.clear();
    };
  }, []);

  const contextValue = useMemo<AppToastContextValue>(() => ({ pushToast }), [pushToast]);

  return (
    <AppToastContext.Provider value={contextValue}>
      {children}
      <div aria-atomic="false" aria-live="polite" className="app-toast-stack">
        {toasts.map((toast) => (
          <section
            className={cn("app-toast", `app-toast--${toast.tone ?? "info"}`)}
            key={toast.id}
            role="status"
          >
            <div className="app-toast__signal" aria-hidden="true" />
            <div className="app-toast__body">
              {toast.title ? <strong className="app-toast__title">{toast.title}</strong> : null}
              <p className="app-toast__message">{toast.message}</p>
            </div>
            <button
              aria-label="关闭提示"
              className="app-toast__close"
              onClick={() => dismissToast(toast.id)}
              type="button"
            >
              ×
            </button>
          </section>
        ))}
      </div>
    </AppToastContext.Provider>
  );
}

export function useAppToast() {
  const context = useContext(AppToastContext);
  if (!context) {
    throw new Error("useAppToast must be used within AppToastProvider");
  }
  return context;
}
