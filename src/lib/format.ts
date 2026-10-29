export function formatDateTime(value: string | number | Date): string {
  const date = new Date(value);
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatRelativeTime(value: string | number | Date): string {
  const date = new Date(value);
  const diffMs = date.getTime() - Date.now();
  const diffSec = Math.round(diffMs / 1000);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31536000],
    ["month", 2592000],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
    ["second", 1],
  ];
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  for (const [unit, secondsInUnit] of units) {
    if (Math.abs(diffSec) >= secondsInUnit || unit === "second") {
      return rtf.format(Math.round(diffSec / secondsInUnit), unit);
    }
  }
  return rtf.format(0, "second");
}

export const ACTION_LABELS: Record<string, string> = {
  "admin.login.success": "Admin signed in",
  "admin.login.denied": "Sign-in denied (not authorized)",
  "admin.logout": "Admin signed out",
  "personality.update": "Updated Anjali personality",
  "ai_config.update": "Updated AI configuration",
  "customization.update": "Updated app customization",
  "general_settings.update": "Updated general settings",
  "general_settings.maintenance_toggle": "Changed maintenance mode",
  "user.status_change": "Changed a user's account status",
  "customization.avatar_upload": "Uploaded a new avatar image",
};
