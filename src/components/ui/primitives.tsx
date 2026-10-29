"use client";

import { type ReactNode, type ButtonHTMLAttributes } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-app-border bg-app-surface shadow-sm shadow-pink-950/[0.03]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-app-border px-5 py-4">
      <div>
        <h3 className="text-sm font-semibold text-app-text">{title}</h3>
        {description && <p className="mt-0.5 text-xs text-app-text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export function Button({
  variant = "primary",
  loading,
  className,
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; loading?: boolean }) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-400/60";
  const variants: Record<ButtonVariant, string> = {
    primary:
      "bg-gradient-to-r from-pink-500 to-purple-500 text-white shadow-sm shadow-pink-500/25 hover:shadow-md hover:shadow-pink-500/30 active:scale-[0.98]",
    secondary:
      "bg-app-bg-soft text-app-text border border-app-border hover:bg-app-border/50 active:scale-[0.98]",
    ghost: "text-app-text-muted hover:bg-app-bg-soft hover:text-app-text",
    danger: "bg-rose-600 text-white hover:bg-rose-700 active:scale-[0.98]",
  };
  return (
    <button className={cn(base, variants[variant], className)} disabled={disabled || loading} {...rest}>
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

export function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: "neutral" | "success" | "warning" | "danger" | "info" | "accent";
  children: ReactNode;
  className?: string;
}) {
  const tones: Record<string, string> = {
    neutral: "bg-app-bg-soft text-app-text-muted",
    success: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
    warning: "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300",
    danger: "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300",
    info: "bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300",
    accent: "bg-pink-50 text-pink-700 dark:bg-pink-500/10 dark:text-pink-300",
  };
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium", tones[tone], className)}>
      {children}
    </span>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      {icon && <div className="mb-1 text-app-text-muted">{icon}</div>}
      <p className="text-sm font-semibold text-app-text">{title}</p>
      {description && <p className="max-w-sm text-xs text-app-text-muted">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("h-5 w-5 animate-spin text-pink-500", className)} />;
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-app-text">{title}</h1>
        {description && <p className="mt-1 text-sm text-app-text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-app-text">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-app-text-muted">{hint}</span>}
      {error && <span className="mt-1 block text-xs font-medium text-rose-500">{error}</span>}
    </label>
  );
}

export const inputClass =
  "w-full rounded-xl border border-app-border bg-app-bg px-3.5 py-2.5 text-sm text-app-text placeholder:text-app-text-muted/70 outline-none transition focus:border-pink-400 focus:ring-2 focus:ring-pink-400/20";

export const textAreaClass = cn(inputClass, "min-h-[100px] resize-y leading-relaxed");
