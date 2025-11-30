import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { ToastProvider } from "@/components/ToastProvider";

export const metadata: Metadata = {
  title: "PostAI Planner",
  description: "Self-service social content planner with Late API.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#050711] text-slate-100 antialiased">
        <ToastProvider>
          <div className="sticky top-0 z-40 border-b border-white/10 bg-[#050711]/80 backdrop-blur">
            <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-tr from-indigo-500 via-sky-500 to-purple-500 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30">
                P
              </div>
              <div className="leading-tight">
                <p className="text-sm font-semibold text-white">PostAI</p>
                <p className="text-xs text-slate-400">
                  Планировщик контента для Помни
                </p>
              </div>
            </div>
          </div>
          <div className="mx-auto max-w-6xl px-4 pb-10 pt-6">{children}</div>
        </ToastProvider>
      </body>
    </html>
  );
}
