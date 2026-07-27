import { Link, useLocation } from "wouter";
import { ReactNode } from "react";
import { LayoutDashboard, Swords, Users, LogOut, Activity, ArrowDownCircle, ArrowUpCircle, MessageSquare } from "lucide-react";
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

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground selection:bg-primary/30">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-card flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-border">
          <Activity className="w-6 h-6 text-primary mr-2" />
          <h1 className="text-xl font-bold font-mono tracking-tight text-white uppercase">Jazment Ops</h1>
        </div>
        
        <nav className="flex-1 py-6 px-3 space-y-1">
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
                <item.icon className={`w-5 h-5 mr-3 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border">
          <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={logout}>
            <LogOut className="w-5 h-5 mr-3" />
            Logout
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-background/50">
        <div className="p-8 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
