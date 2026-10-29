"use client";

import { useEffect } from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/primitives";

export function SaveBar({
  dirty,
  saving,
  onSave,
  onCancel,
  lastUpdatedLabel,
}: {
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
  lastUpdatedLabel?: string;
}) {
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  return (
    <div className="sticky bottom-4 z-30 mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-app-border bg-app-surface/95 px-4 py-3 shadow-lg shadow-pink-950/5 backdrop-blur">
      <div className="flex items-center gap-2 text-xs text-app-text-muted">
        {dirty ? (
          <>
            <AlertCircle className="h-4 w-4 text-amber-500" />
            <span className="font-medium text-app-text">You have unsaved changes</span>
          </>
        ) : (
          lastUpdatedLabel && <span>{lastUpdatedLabel}</span>
        )}
      </div>
      <div className="flex gap-2">
        <Button variant="secondary" onClick={onCancel} disabled={!dirty || saving}>
          Cancel
        </Button>
        <Button onClick={onSave} loading={saving} disabled={!dirty}>
          Save changes
        </Button>
      </div>
    </div>
  );
}
