import { useState } from "react";
import {
  useGetAdminStats,
  useGetAdminStatsChart,
  getGetAdminStatsQueryKey,
  getGetAdminStatsChartQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { usePendingRequestAlerts } from "@/components/PendingRequestAlerts";
import { format } from "date-fns";
import {
  Users, Activity, ArrowUpRight, ArrowDownRight, Clock, RefreshCw, AlertTriangle, MessageSquare, ChevronRight,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";

const CHART_DAYS_OPTIONS = [7, 14, 30] as const;

function fmt(n?: number) {
  if (n == null) return "—";
  return n >= 10_000_00
    ? `₹${(n / 10_000_00).toFixed(1)}Cr`
    : n >= 1_00_000
      ? `₹${(n / 1_00_000).toFixed(1)}L`
      : `₹${n.toLocaleString("en-IN")}`;
}

function fmtShort(n: number) {
  return n >= 1_00_000 ? `${(n / 1_00_000).toFixed(0)}L` : n >= 1000 ? `${(n / 1000).toFixed(0)}K` : String(Math.round(n));
}

export function Dashboard() {
  const [chartDays, setChartDays] = useState<7 | 14 | 30>(30);
  const {
    pendingDeposits,
    unresolvedSupportTickets,
    supportTickets,
  } = usePendingRequestAlerts();
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useGetAdminStats({
    query: { queryKey: getGetAdminStatsQueryKey(), refetchInterval: 30_000 },
  });
  const { data: chartData, isLoading: chartLoading } = useGetAdminStatsChart(
    { days: chartDays },
    { query: { queryKey: getGetAdminStatsChartQueryKey({ days: chartDays }) } },
  );

  const chartRows = (chartData?.data ?? []).map((d: any) => ({
    ...d,
    label: format(new Date(d.date), "dd MMM"),
  }));

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Operations Dashboard</h1>
          <p className="text-muted-foreground mt-1 text-sm uppercase tracking-wider">Accounts, wallets and payment activity</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 text-green-500 rounded-full text-sm font-medium border border-green-500/20">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            LIVE
          </div>
          <Button variant="outline" size="sm" onClick={() => refetchStats()}>
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
          </Button>
        </div>
      </div>

      {(pendingDeposits > 0 || unresolvedSupportTickets > 0) && (
        <section
          className="rounded-xl border border-warning/30 bg-warning/[0.06] p-4 md:p-5 shadow-[0_0_24px_hsl(var(--warning)/0.08)]"
          aria-label="Items needing attention"
          data-testid="dashboard-attention-alert"
        >
          <div className="flex items-start gap-3 mb-4">
            <div className="rounded-lg bg-warning/15 p-2 text-warning">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">Needs your attention</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Review these items as soon as possible.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {pendingDeposits > 0 && (
              <Link
                href="/deposits?status=pending"
                className="group rounded-lg border border-warning/25 bg-card/70 p-4 hover:border-warning/60 transition-colors"
                data-testid="dashboard-pending-deposits-alert"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="rounded-md bg-emerald-500/10 p-2 text-emerald-400">
                      <ArrowDownRight className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Deposit requests</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {pendingDeposits} pending {pendingDeposits === 1 ? "request" : "requests"} awaiting review
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-warning transition-colors" />
                </div>
              </Link>
            )}

            {unresolvedSupportTickets > 0 && (
              <Link
                href="/support"
                className="group rounded-lg border border-warning/25 bg-card/70 p-4 hover:border-warning/60 transition-colors"
                data-testid="dashboard-support-alert"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="rounded-md bg-rose-500/10 p-2 text-rose-400 shrink-0">
                      <MessageSquare className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">Support issues</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {unresolvedSupportTickets} unresolved {unresolvedSupportTickets === 1 ? "issue" : "issues"} need a response
                      </p>
                      {supportTickets.slice(0, 2).map((ticket) => (
                        <p key={ticket.id} className="text-xs text-foreground/80 truncate mt-1">
                          {ticket.subject}
                        </p>
                      ))}
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-warning transition-colors shrink-0" />
                </div>
              </Link>
            )}
          </div>
        </section>
      )}

      <section>
        <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3 font-semibold">Users & Accounts</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <KpiCard title="Total Users" value={stats?.totalUsers.toLocaleString()} subtitle="Registered accounts" icon={Users} loading={statsLoading} />
          <KpiCard title="Active Users" value={stats?.activeUsers.toLocaleString()} subtitle="Status active" icon={Activity} loading={statsLoading} highlight="blue" />
        </div>
      </section>

      <section>
        <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3 font-semibold">Deposits & Withdrawals</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard title="Total Deposits" value={fmt(stats?.totalDeposits)} subtitle="All approved" icon={ArrowDownRight} loading={statsLoading} highlight="green" />
          <KpiCard title="Total Withdrawals" value={fmt(stats?.totalWithdrawals)} subtitle="All approved" icon={ArrowUpRight} loading={statsLoading} />
          <KpiCard
            title="Pending Deposits"
            value={stats?.pendingDepositsCount.toLocaleString()}
            subtitle={stats?.pendingDepositsAmount ? `${fmt(stats.pendingDepositsAmount)} pending` : "Awaiting approval"}
            icon={Clock}
            loading={statsLoading}
            highlight={stats?.pendingDepositsCount ? "amber" : undefined}
            href="/deposits?status=pending"
          />
          <KpiCard
            title="Pending Withdrawals"
            value={stats?.pendingWithdrawalsCount.toLocaleString()}
            subtitle={stats?.pendingWithdrawalsAmount ? `${fmt(stats.pendingWithdrawalsAmount)} pending` : "Awaiting approval"}
            icon={Clock}
            loading={statsLoading}
            highlight={stats?.pendingWithdrawalsCount ? "amber" : undefined}
            href="/withdrawals?status=pending"
          />
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Payment Trends</p>
          <div className="flex gap-1">
            {CHART_DAYS_OPTIONS.map((d) => (
              <Button key={d} size="sm" variant={chartDays === d ? "default" : "outline"} className="h-7 px-3 text-xs" onClick={() => setChartDays(d)}>
                {d}d
              </Button>
            ))}
          </div>
        </div>
        <ChartCard title="Deposits vs Withdrawals" loading={chartLoading}>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={chartRows} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gDeposit" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gWithdraw" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border)/0.5)" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tickFormatter={fmtShort} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} width={40} />
              <Tooltip formatter={(v: number) => [`₹${v.toLocaleString("en-IN")}`, ""]} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} labelStyle={{ color: "hsl(var(--foreground))" }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Area type="monotone" dataKey="deposits" name="Deposits" stroke="#22c55e" fill="url(#gDeposit)" strokeWidth={2} dot={false} />
              <Area type="monotone" dataKey="withdrawals" name="Withdrawals" stroke="#ef4444" fill="url(#gWithdraw)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      </section>
    </div>
  );
}

const HIGHLIGHT_STYLES: Record<string, string> = {
  green: "text-success",
  blue: "text-blue-400",
  amber: "text-warning",
};

function KpiCard({
  title, value, subtitle, icon: Icon, loading, highlight, href,
}: {
  title: string;
  value?: string;
  subtitle: string;
  icon: React.ElementType;
  loading?: boolean;
  highlight?: string;
  href?: string;
}) {
  const content = (
    <Card className={href ? "hover:border-primary/40 transition-colors cursor-pointer" : ""}>
      <CardContent className="p-5">
        <div className="flex justify-between items-start mb-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider leading-tight">{title}</p>
          <div className="p-2 bg-muted/50 rounded-lg"><Icon className="w-4 h-4 text-muted-foreground" /></div>
        </div>
        {loading ? <div className="h-8 w-24 bg-muted/50 rounded animate-pulse" /> : (
          <p className={`text-2xl font-bold font-mono tracking-tight ${highlight ? HIGHLIGHT_STYLES[highlight] : "text-foreground"}`}>{value ?? "0"}</p>
        )}
        <p className="text-xs text-muted-foreground mt-2">{subtitle}</p>
      </CardContent>
    </Card>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}

function ChartCard({ title, loading, children }: { title: string; loading?: boolean; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2 pt-4 px-5"><CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{title}</CardTitle></CardHeader>
      <CardContent className="px-4 pb-4">
        {loading ? <div className="h-[260px] flex items-center justify-center"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div> : children}
      </CardContent>
    </Card>
  );
}