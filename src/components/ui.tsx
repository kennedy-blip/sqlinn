import { useEffect, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { cn } from "@/utils/cn";

export type ToastKind = "success" | "info" | "error";

export interface ToastItem {
  id: string;
  message: string;
  detail?: string;
  kind: ToastKind;
}

const toastIcons = {
  success: CheckCircle2,
  info: Info,
  error: AlertTriangle,
};

const toastStyles = {
  success: "border-emerald-500/25 text-emerald-300",
  info: "border-cyan-500/25 text-cyan-300",
  error: "border-amber-500/30 text-amber-300",
};

export function ToastStack({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}) {
  return (
    <div className="pointer-events-none fixed bottom-9 right-4 z-[80] flex w-[min(360px,calc(100vw-2rem))] flex-col gap-2">
      {toasts.map((toast) => {
        const Icon = toastIcons[toast.kind];
        return (
          <div
            key={toast.id}
            className={cn(
              "pointer-events-auto flex animate-slide-up items-start gap-3 rounded-lg border bg-[#0b1420]/95 px-3.5 py-3 shadow-[0_16px_44px_rgba(0,0,0,0.5)] backdrop-blur-xl",
              toastStyles[toast.kind],
            )}
          >
            <Icon className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-[12.5px] font-medium text-slate-100">{toast.message}</p>
              {toast.detail && <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">{toast.detail}</p>}
            </div>
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              className="rounded p-0.5 text-slate-500 transition hover:bg-white/5 hover:text-slate-200"
              aria-label="Dismiss notification"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  children,
  width = "max-w-[720px]",
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  width?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-[#03060c]/80 backdrop-blur-[6px]"
        aria-label="Close dialog"
      />
      <div
        className={cn(
          "relative z-10 w-full animate-slide-up overflow-hidden rounded-xl border border-[#233148] bg-[#0a111d] shadow-[0_32px_100px_rgba(0,0,0,0.7)]",
          width,
        )}
        role="dialog"
        aria-modal="true"
      >
        {children}
      </div>
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-[19px] min-w-[19px] items-center justify-center rounded border border-white/10 bg-white/[0.04] px-1.5 font-mono text-[9.5px] font-medium text-slate-400">
      {children}
    </kbd>
  );
}

export function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "text-[9.5px] font-semibold uppercase tracking-[0.16em] text-slate-500",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function LiveDot({ className }: { className?: string }) {
  return (
    <span className={cn("relative flex h-1.5 w-1.5", className)}>
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-50" />
      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
    </span>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex h-full min-h-[180px] flex-col items-center justify-center px-6 py-8 text-center">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg border border-[#223046] bg-[#0c1624] text-slate-500">
        {icon}
      </div>
      <p className="text-[13px] font-medium text-slate-200">{title}</p>
      <p className="mt-1 max-w-[310px] text-[11.5px] leading-relaxed text-slate-500">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
