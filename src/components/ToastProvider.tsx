'use client';

import { createContext, useCallback, useContext, useMemo, useState } from "react";

type ToastType = "success" | "error" | "warning";

type Toast = {
  id: number;
  type: ToastType;
  title: string;
  description?: string;
};

type ToastContextValue = {
  showToast: (toast: Omit<Toast, "id">) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((toast: Omit<Toast, "id">) => {
    setToasts((prev) => {
      const id = Date.now() + Math.random();
      return [...prev, { ...toast, id }];
    });
    setTimeout(() => {
      setToasts((prev) => prev.slice(1));
    }, 3000);
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 space-y-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="w-80 rounded-lg border border-white/10 bg-slate-900/90 px-4 py-3 shadow-xl backdrop-blur"
          >
            <p
              className={`text-sm font-semibold ${
                toast.type === "success"
                  ? "text-emerald-300"
                  : toast.type === "error"
                    ? "text-rose-300"
                    : "text-amber-300"
              }`}
            >
              {toast.title}
            </p>
            {toast.description && (
              <p className="text-xs text-slate-300">{toast.description}</p>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
