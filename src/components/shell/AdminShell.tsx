"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Sparkles,
  SlidersHorizontal,
  Palette,
  Users,
  Gauge,
  Settings,
  ScrollText,
  PlugZap,
  Menu,
  X,
  LogOut,
  ChevronsLeft,
  ChevronsRight,
  Moon,
  Sun,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { useTheme } from "@/components/providers/ThemeProvider";
import { useToast } from "@/components/providers/ToastProvider";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/personality", label: "Anjali Personality", icon: Sparkles },
  { href: "/ai-config", label: "AI Configuration", icon: SlidersHorizontal },
  { href: "/customization", label: "App Customization", icon: Palette },
  { href: "/users", label: "User Management", icon: Users },
  { href: "/usage", label: "AI Usage & Limits", icon: Gauge },
  { href: "/settings", label: "General Settings", icon: Settings },
  { href: "/audit-logs", label: "Admin Activity", icon: ScrollText },
  { href: "/integration", label: "Integration & Status", icon: PlugZap },
];

export function AdminShell({
  children,
  admin,
}: {
  children: ReactNode;
  admin: { email: string; name?: string; picture?: string; role: string };
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const { notify } = useToast();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/session", { method: "DELETE" });
      notify({ kind: "success", title: "Signed out" });
      router.push("/login");
      router.refresh();
    } catch {
      notify({ kind: "error", title: "Could not sign out", description: "Please try again." });
    } finally {
      setLoggingOut(false);
    }
  }

  const initials = (admin.name || admin.email)
    .split(/[\s@.]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");

  return (
    <div className="flex min-h-screen bg-app-bg">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col border-r border-app-border bg-app-surface transition-all duration-200 lg:static lg:translate-x-0",
          collapsed ? "lg:w-[76px]" : "lg:w-64",
          "w-64",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-app-border px-4">
          <Link href="/dashboard" className="flex items-center gap-2 overflow-hidden">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500 to-purple-500 text-sm font-bold text-white">
              A
            </div>
            {!collapsed && (
              <div className="truncate">
                <p className="truncate text-sm font-semibold text-app-text">ANJALI</p>
                <p className="truncate text-[11px] text-app-text-muted">Admin Dashboard</p>
              </div>
            )}
          </Link>
          <button
            className="rounded-lg p-1.5 text-app-text-muted hover:bg-app-bg-soft lg:hidden"
            onClick={() => setMobileOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="scrollbar-thin flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-gradient-to-r from-pink-50 to-purple-50 text-pink-700 dark:from-pink-500/10 dark:to-purple-500/10 dark:text-pink-300"
                    : "text-app-text-muted hover:bg-app-bg-soft hover:text-app-text",
                )}
                title={collapsed ? item.label : undefined}
              >
                <Icon className="h-[18px] w-[18px] shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="hidden border-t border-app-border p-3 lg:block">
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-app-text-muted hover:bg-app-bg-soft"
          >
            {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
            {!collapsed && "Collapse"}
          </button>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-h-screen flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-app-border bg-app-surface/90 px-4 backdrop-blur sm:px-6">
          <button
            className="rounded-lg p-2 text-app-text-muted hover:bg-app-bg-soft lg:hidden"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="hidden lg:block" />
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={toggleTheme}
              className="rounded-lg p-2 text-app-text-muted hover:bg-app-bg-soft"
              aria-label="Toggle dark mode"
            >
              {theme === "light" ? <Moon className="h-[18px] w-[18px]" /> : <Sun className="h-[18px] w-[18px]" />}
            </button>
            <div className="flex items-center gap-2 rounded-xl border border-app-border px-2.5 py-1.5">
              {admin.picture ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={admin.picture} alt="" className="h-6 w-6 rounded-full" />
              ) : (
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 to-purple-500 text-[10px] font-semibold text-white">
                  {initials || "A"}
                </div>
              )}
              <div className="hidden text-left sm:block">
                <p className="text-xs font-medium leading-none text-app-text">{admin.name || admin.email}</p>
                <p className="mt-0.5 text-[10px] uppercase tracking-wide text-app-text-muted">{admin.role}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="rounded-lg p-2 text-app-text-muted hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50 dark:hover:bg-rose-500/10"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut className="h-[18px] w-[18px]" />
            </button>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
