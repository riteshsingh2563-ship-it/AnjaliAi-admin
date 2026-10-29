"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/primitives";

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  danger,
  loading,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm">
      <div className="animate-fade-in-up w-full max-w-md rounded-2xl border border-app-border bg-app-surface p-6 shadow-xl">
        <div className="flex items-start gap-3">
          <div
            className={`rounded-full p-2 ${danger ? "bg-rose-50 text-rose-600 dark:bg-rose-500/10" : "bg-pink-50 text-pink-600 dark:bg-pink-500/10"}`}
          >
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-semibold text-app-text">{title}</h3>
            {description && <p className="mt-1.5 text-sm text-app-text-muted">{description}</p>}
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button variant={danger ? "danger" : "primary"} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
