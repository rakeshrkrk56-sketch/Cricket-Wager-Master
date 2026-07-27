import { useState } from "react";
import {
  useGetAdminStats,
  useGetAdminStatsChart,
  useAdminListMatches,
  getGetAdminStatsQueryKey,
  getGetAdminStatsChartQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { format } from "date-fns";
import {
  Users, Activity, Wallet, Banknote, Swords, DollarSign,
  ArrowUpRight, ArrowDownRight, TrendingUp, TrendingDown,
  Clock, RefreshCw, ArrowUp, ArrowDown, Target, Percent,
  ChartBar, CircleDollarSign,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
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

  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useGetAdminStats({
    query: { queryKey: getGetAdminStatsQueryKey(), refetchInterval: 30_000 },
  });
  const { data: chartData, isLoading: chartLoading } = useGetAdminStatsChart(
    { days: chartDays },
    { query: { queryKey: getGetAdminStatsChartQueryKey({ days: chartDays }) } }
  );
  const { data: matchesData } = useAdminListMatches({ status: "live" });

  const liveMatches = matchesData?.matches ?? [];
  const chartRows = (chartData?.data ?? []).map((d: any) => ({
    ...d,
    label: format(new Date(d.date), "dd MMM"),
  }));

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Analytics Dashboard</h1>
          <p className="text-muted-foreground mt-1 text-sm uppercase tracking-wider">Live Platform Metrics (लाइव विश्लेषण)</p>
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

      {/* ── Row 1: Users & Matches ─────────────────────────────────── */}
      <section>
        <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3 font-semibold">Users & Platform</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard title="Total Users" value={stats?.totalUsers.toLocaleString()} subtitle="Registered" icon={Users} loading={statsLoading} />
          <KpiCard title="Active Users" value={stats?.activeUsers.toLocaleString()} subtitle="Status active" icon={Activity} loading={statsLoading} highlight="blue" />
          <KpiCard title="Live Matches" value={stats?.liveMatches.toLocaleString()} subtitle={`of ${stats?.totalMatches ?? "—"} total`} icon={Swords} loading={statsLoading} highlight={stats?.liveMatches ? "green" : undefined} />
          <KpiCard title="Success Rate" value={stats != null ? `${stats.predictionSuccessRate}%` : undefined} subtitle="Won / settled bets" icon={Percent} loading={statsLoading} />
        </div>
      </section>

      {/* ── Row 2: Deposits & Withdrawals ────────────────────────── */}
      <section>
        <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3 font-semibold">Deposits & Withdrawals</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard title="Total Deposits" value={fmt(stats?.totalDeposits)} subtitle="All approved" icon={ArrowDownRight} loading={statsLoading} highlight="green" />
          <KpiCard title="Total Withdrawals" value={fmt(stats?.totalWithdrawals)} subtitle="All approved" icon={ArrowUpRight} loading={statsLoading} />
          <KpiCard
            title="Pending Deposits"
            value={stats?.pendingDepositsCount.toLocaleString()}
            subtitle={stats?.pendingDepositsAmount ? fmt(stats.pendingDepositsAmount) + " pending" : "Awaiting approval"}
            icon={Clock}
            loading={statsLoading}
            highlight={stats?.pendingDepositsCount ? "amber" : undefined}
            href="/deposits?status=pending"
          />
          <KpiCard
            title="Pending Withdrawals"
            value={stats?.pendingWithdrawalsCount.toLocaleString()}
            subtitle={stats?.pendingWithdrawalsAmount ? fmt(stats.pendingWithdrawalsAmount) + " pending" : "Awaiting approval"}
            icon={Clock}
            loading={statsLoading}
            highlight={stats?.pendingWithdrawalsCount ? "amber" : undefined}
            href="/withdrawals?status=pending"
          />
        </div>
      </section>

      {/* ── Row 3: Revenue & Bets ────────────────────────────────── */}
      <section>
        <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3 font-semibold">Revenue & Bets</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard title="Platform Revenue" value={fmt(stats?.platformRevenue)} subtitle="Volume − payouts" icon={CircleDollarSign} loading={statsLoading} highlight="green" />
          <KpiCard title="Today's Profit" value={fmt(stats?.todayProfit)} subtitle="Deposits − withdrawals" icon={TrendingUp} loading={statsLoading} highlight={(stats?.todayProfit ?? 0) >= 0 ? "green" : "red"} />
          <KpiCard title="Total Bets" value={stats?.totalPredictions.toLocaleString()} subtitle="All predictions" icon={ChartBar} loading={statsLoading} />
          <KpiCard title="Total Payout" value={fmt(stats?.totalPayout)} subtitle="Paid to winners" icon={Wallet} loading={statsLoading} />
        </div>
      </section>

      {/* ── Charts ───────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">Daily Trends</p>
          <div className="flex gap-1">
            {CHART_DAYS_OPTIONS.map((d) => (
              <Button key={d} size="sm" variant={chartDays === d ? "default" : "outline"} className="h-7 px-3 text-xs" onClick={() => setChartDays(d)}>
                {d}d
              </Button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartCard title="Deposits vs Withdrawals" loading={chartLoading}>
            <ResponsiveContainer width="100%" height={220}>
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

          <ChartCard title="Daily Bets Volume" loading={chartLoading}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartRows} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border)/0.5)" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis tickFormatter={fmtShort} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} width={40} />
                <Tooltip formatter={(v: number) => [`₹${v.toLocaleString("en-IN")}`, ""]} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} labelStyle={{ color: "hsl(var(--foreground))" }} />
                <Bar dataKey="bets" name="Bets" fill="#f47d1c" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Platform Revenue" loading={chartLoading}>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartRows} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f47d1c" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f47d1c" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border)/0.5)" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis tickFormatter={fmtShort} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} width={40} />
                <Tooltip formatter={(v: number) => [`₹${v.toLocaleString("en-IN")}`, ""]} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} labelStyle={{ color: "hsl(var(--foreground))" }} />
                <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#f47d1c" fill="url(#gRevenue)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Deposits vs Revenue" loading={chartLoading}>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartRows} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border)/0.5)" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis tickFormatter={fmtShort} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} width={40} />
                <Tooltip formatter={(v: number) => [`₹${v.toLocaleString("en-IN")}`, ""]} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }} labelStyle={{ color: "hsl(var(--foreground))" }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="deposits" name="Deposits" stroke="#22c55e" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="revenue" name="Revenue" stroke="#f47d1c" strokeWidth={2} dot={false} strokeDasharray="5 3" />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      </section>

      {/* ── Live Matches ─────────────────────────────────────────── */}
      {liveMatches.length > 0 && (
        <section>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold flex items-center gap-2">
              Live Matches <Badge variant="live">LIVE</Badge>
            </h2>
            <Link href="/matches" className="text-sm text-primary hover:underline">View All</Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {liveMatches.map((m) => (
              <Link key={m.id} href={`/matches/${m.id}`}>
                <Card className="hover:border-primary/40 transition-colors cursor-pointer">
                  <CardContent className="p-4">
                    <Badge variant="outline" className="text-[10px] mb-2">{m.tournament}</Badge>
                    <div className="flex justify-between items-center font-bold text-base">
                      <span>{m.team1}</span>
                      <span className="text-muted-foreground text-xs">vs</span>
                      <span>{m.team2}</span>
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      Started {format(new Date(m.startTime), "HH:mm")}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

const HIGHLIGHT_STYLES: Record<string, string> = {
  green: "text-success",
  blue: "text-blue-400",
  amber: "text-warning",
  red: "text-destructive",
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
          <div className="p-2 bg-muted/50 rounded-lg">
            <Icon className="w-4 h-4 text-muted-foreground" />
          </div>
        </div>
        {loading ? (
          <div className="h-8 w-24 bg-muted/50 rounded animate-pulse" />
        ) : (
          <p className={`text-2xl font-bold font-mono tracking-tight ${highlight ? HIGHLIGHT_STYLES[highlight] : "text-foreground"}`}>
            {value ?? "0"}
          </p>
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
      <CardHeader className="pb-2 pt-4 px-5">
        <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{title}</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {loading ? (
          <div className="h-[220px] flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : children}
      </CardContent>
    </Card>
  );
}

function PendingCard({
  title,
  count,
  amount,
  icon: Icon,
  accentClass,
  borderClass,
}: {
  title: string;
  count: number;
  amount: number;
  icon: any;
  accentClass: string;
  borderClass: string;
}) {
  const hasItems = count > 0;

  return (
    <Card className={`cursor-pointer transition-colors ${borderClass} ${hasItems ? "border-opacity-70" : ""}`}>
      <CardContent className="p-6">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">{title}</p>
            <h3 className={`text-3xl font-bold font-mono tracking-tight ${hasItems ? accentClass : "text-foreground"}`}>
              {count.toLocaleString()}
            </h3>
            <p className={`text-sm font-medium mt-1 ${hasItems ? accentClass : "text-muted-foreground"}`}>
              ₹{amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} pending
            </p>
          </div>
          <div className={`p-3 rounded-lg ${hasItems ? `bg-current/10` : "bg-card-border"}`}>
            <Icon className={`w-5 h-5 ${hasItems ? accentClass : "text-muted-foreground"}`} />
          </div>
        </div>
        <div className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="w-3 h-3" />
          <span>Refreshes every 30s · Click to review</span>
        </div>
      </CardContent>
    </Card>
  );
}
