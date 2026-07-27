import { useGetAdminStats, useAdminListMatches } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Activity, Wallet, Banknote, Swords, DollarSign, ArrowUpRight, ArrowDownRight, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { format } from "date-fns";

export function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetAdminStats();
  const { data: matchesData, isLoading: matchesLoading } = useAdminListMatches({ status: "live" });

  if (statsLoading || matchesLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const liveMatches = matchesData?.matches || [];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Dashboard</h1>
          <p className="text-muted-foreground mt-1 text-sm uppercase tracking-wider">Live Platform Status (लाइव स्थिति)</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 text-green-500 rounded-full text-sm font-medium border border-green-500/20">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          SYSTEM NOMINAL
        </div>
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          title="Active Users" 
          value={stats?.activeUsers.toLocaleString()} 
          subtitle="Out of total users" 
          icon={Activity} 
          trend="+12%" 
        />
        <StatCard 
          title="Pending Predictions" 
          value={stats?.pendingPredictions.toLocaleString()} 
          subtitle="Awaiting settlement" 
          icon={Banknote} 
          valueColor="text-warning"
        />
        <StatCard 
          title="Today's Volume" 
          value={`₹${stats?.totalVolume.toLocaleString()}`} 
          subtitle="Total matched" 
          icon={Wallet} 
        />
        <StatCard 
          title="Platform Revenue" 
          value={`₹${stats?.platformRevenue.toLocaleString()}`} 
          subtitle="Net retained" 
          icon={DollarSign} 
          valueColor="text-success"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Live Matches */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold">Live Matches <Badge variant="live" className="ml-2">LIVE (लाइव)</Badge></h2>
            <Link href="/matches" className="text-sm text-primary hover:underline font-medium">View All</Link>
          </div>
          
          {liveMatches.length === 0 ? (
            <Card className="bg-card/50 border-dashed">
              <CardContent className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                <Swords className="w-8 h-8 mb-2 opacity-50" />
                <p>No live matches currently.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {liveMatches.map((match) => (
                <Link key={match.id} href={`/matches/${match.id}`}>
                  <Card className="hover:border-primary/50 transition-colors cursor-pointer group h-full">
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <Badge variant="outline" className="text-[10px]">{match.tournament}</Badge>
                        {match.liveScore?.score && (
                          <span className="font-mono font-bold text-primary">{match.liveScore.score}</span>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex justify-between items-center text-lg font-bold mt-2">
                        <span>{match.team1}</span>
                        <span className="text-muted-foreground text-sm font-normal">vs</span>
                        <span>{match.team2}</span>
                      </div>
                      <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground border-t border-border pt-4">
                        <span>Started {format(new Date(match.startTime), "HH:mm")}</span>
                        <span className="group-hover:text-primary transition-colors flex items-center gap-1 uppercase tracking-wider font-semibold">
                          Manage <ArrowUpRight className="w-3 h-3" />
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Right Column - Secondary Stats */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold">Daily Flows</h2>
          <Card>
            <CardContent className="p-0">
              <div className="p-6 border-b border-border flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-1">Total Users</p>
                  <p className="text-2xl font-bold font-mono">{stats?.totalUsers.toLocaleString()}</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <Users className="w-6 h-6" />
                </div>
              </div>
              <div className="p-6 border-b border-border flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-1">Today Deposits</p>
                  <p className="text-2xl font-bold font-mono text-success flex items-center">
                    <ArrowDownRight className="w-5 h-5 mr-1" />
                    ₹{stats?.todayDeposits.toLocaleString()}
                  </p>
                </div>
              </div>
              <div className="p-6 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-1">Today Withdrawals</p>
                  <p className="text-2xl font-bold font-mono text-destructive flex items-center">
                    <ArrowUpRight className="w-5 h-5 mr-1" />
                    ₹{stats?.todayWithdrawals.toLocaleString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StatCard({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  trend,
  valueColor = "text-foreground"
}: { 
  title: string, 
  value?: string, 
  subtitle: string, 
  icon: any, 
  trend?: string,
  valueColor?: string
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">{title}</p>
            <h3 className={`text-3xl font-bold font-mono tracking-tight ${valueColor}`}>{value || "0"}</h3>
          </div>
          <div className="p-3 bg-card-border rounded-lg">
            <Icon className="w-5 h-5 text-muted-foreground" />
          </div>
        </div>
        <div className="mt-4 flex items-center text-xs text-muted-foreground">
          {trend && <span className="text-success font-medium mr-2">{trend}</span>}
          {subtitle}
        </div>
      </CardContent>
    </Card>
  );
}
