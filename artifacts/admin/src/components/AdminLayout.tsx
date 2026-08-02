import { Link, useLocation } from "wouter";
import { ReactNode, useState, useEffect } from "react";
import { LayoutDashboard, Swords, Users, LogOut, Activity, ArrowDownCircle, ArrowUpCircle, MessageSquare, Menu, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { useAdminListDeposits, useAdminListWithdrawals, useAdminListSupportTickets } from "@workspace/api-client-react";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/matches", label: "Matches (मैच)", icon: Swords },
  { href: "/users", label: "Users (उपयोगकर्ता)", icon: Users },
  { href: "/deposits", label: "Deposits (जमा)", icon: ArrowDownCircle },
  { href: "/withdrawals", label: "Withdrawals (निकासी)", icon: ArrowUpCircle },
  { href: "/support", label: "Support (सहायता)", icon: MessageSquare },
];

export function AdminLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close sidebar on route change
  useEffect(() => {
    setSidebarOpen(false);
  }, [location]);

  // Close sidebar on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSidebarOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const SidebarContent = () => (
    <>
      {/* Logo header */}
      <div className="h-16 flex items-center justify-between px-6 border-b border-border flex-shrink-0">
        <div className="flex items-center">
          <Activity className="w-6 h-6 text-primary mr-2" />
          <h1 className="text-xl font-bold font-mono tracking-tight text-white uppercase">Jazment Ops</h1>
        </div>
        {/* Close button — mobile only */}
        <button
          className="md:hidden p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
          onClick={() => setSidebarOpen(false)}
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Nav links */}
      <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center px-3 py-2.5 rounded-md transition-colors text-sm font-medium ${
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <item.icon className={`w-5 h-5 mr-3 flex-shrink-0 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="p-4 border-t border-border flex-shrink-0">
        <Button
          variant="ghost"
          className="w-full justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          onClick={logout}
        >
          <LogOut className="w-5 h-5 mr-3" />
          Logout
        </Button>
      </div>
    </>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground selection:bg-primary/30">

      {/* ── Desktop sidebar (always visible ≥ md) ── */}
      <aside className="hidden md:flex w-64 border-r border-border bg-card flex-col flex-shrink-0">
        <SidebarContent />
      </aside>

      {/* ── Mobile overlay sidebar ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        >
          {/* Dark backdrop */}
          <div className="absolute inset-0 bg-black/60" />

          {/* Sidebar panel */}
          <aside
            className="absolute left-0 top-0 h-full w-72 bg-card border-r border-border flex flex-col z-50"
            onClick={(e) => e.stopPropagation()}
          >
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* ── Main content area ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile top bar with hamburger */}
        <header className="md:hidden h-14 flex items-center px-4 border-b border-border bg-card flex-shrink-0 gap-3">
          <button
            className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </button>
          <Activity className="w-5 h-5 text-primary" />
          <span className="text-base font-bold font-mono tracking-tight text-white uppercase">Jazment Ops</span>
        </header>

        <main className="flex-1 overflow-auto bg-background/50">
          <div className="p-4 md:p-8 max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
