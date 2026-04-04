"use client";

import { useEffect } from "react";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";

type AlertType = "error" | "success" | "info";

export default function AlertPopup({
  message,
  type = "error",
  onClose,
  autoCloseMs,
}: {
  message: string;
  type?: AlertType;
  onClose?: () => void;
  autoCloseMs?: number;
}) {
  useEffect(() => {
    if (!message || !onClose || !autoCloseMs) return;
    const timer = window.setTimeout(onClose, autoCloseMs);
    return () => window.clearTimeout(timer);
  }, [message, onClose, autoCloseMs]);

  if (!message) return null;

  const styles =
    type === "error"
      ? "border-red-200 bg-red-50 text-red-700"
      : type === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : "border-blue-200 bg-blue-50 text-blue-700";

  const Icon = type === "error" ? AlertTriangle : type === "success" ? CheckCircle2 : Info;

  return (
    <div className="fixed bottom-4 right-4 z-[120] w-[min(24rem,calc(100vw-2rem))] animate-in slide-in-from-bottom-2 fade-in duration-200">
      <div className={`rounded-lg border shadow-lg px-3 py-2.5 flex items-start gap-2.5 ${styles}`}>
        <Icon size={16} className="mt-0.5 shrink-0" />
        <div className="text-sm leading-5 flex-1">{message}</div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded p-0.5 opacity-70 hover:opacity-100 transition-opacity"
            aria-label="Close alert"
          >
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
