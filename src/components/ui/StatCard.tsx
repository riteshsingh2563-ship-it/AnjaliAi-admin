import type { ReactNode } from "react";
import { Card } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";

export function StatCard({
  label,
  value,
  icon,
  tone = "accent",
  footnote,
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  tone?: "accent" | "neutral";
  footnote?: ReactNode;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-app-text-muted">{label}</p>
        {icon && (
          <div
            className={cn(
              "rounded-lg p-2",
              tone === "accent"
                ? "bg-gradient-to-br from-pink-50 to-purple-50 text-pink-600 dark:from-pink-500/10 dark:to-purple-500/10 dark:text-pink-300"
                : "bg-app-bg-soft text-app-text-muted",
            )}
          >
            {icon}
          </div>
        )}
      </div>
      <p className="mt-3 text-2xl font-semibold text-app-text">{value}</p>
      {footnote && <div className="mt-2 text-xs text-app-text-muted">{footnote}</div>}
    </Card>
  );
}
