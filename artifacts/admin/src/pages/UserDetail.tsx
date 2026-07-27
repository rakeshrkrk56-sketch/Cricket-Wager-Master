import { useParams, Link } from "wouter";
import { useGetUser, useUpdateUser, getGetUserQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft, ShieldAlert, ShieldCheck, Ban, CheckCircle2, IndianRupee, TrendingUp, TrendingDown, Target } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export function UserDetail() {
  const { userId } = useParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: user, isLoading } = useGetUser(userId as string, {
    query: { enabled: !!userId, queryKey: getGetUserQueryKey(userId as string) }
  });

  const updateUser = useUpdateUser();

  const handleUpdateKyc = (status: "verified" | "rejected") => {
    if (!userId) return;
    updateUser.mutate({ userId, data: { kycStatus: status } }, {
      onSuccess: () => {
        toast({ title: `KYC marked as ${status}` });
        queryClient.invalidateQueries({ queryKey: getGetUserQueryKey(userId) });
      }
    });
  };

  const handleUpdateStatus = (status: "active" | "suspended") => {
    if (!userId) return;
    if (status === "suspended" && !confirm("Are you sure you want to suspend this user? They will not be able to log in or place trades.")) return;
    
    updateUser.mutate({ userId, data: { status } }, {
      onSuccess: () => {
        toast({ title: `Account ${status === 'active' ? 'activated' : 'suspended'}` });
        queryClient.invalidateQueries({ queryKey: getGetUserQueryKey(userId) });
      }
    });
  };

  if (isLoading) {
    return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  if (!user) return <div>User not found</div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center gap-4">
        <Link href="/users">
          <Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5" /></Button>
        </Link>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-white font-mono">{user.phone}</h1>
            {user.status === 'active' ? (
              <Badge variant="outline" className="text-success border-success/30 bg-success/10">Active</Badge>
            ) : (
              <Badge variant="destructive">Suspended</Badge>
            )}
          </div>
          <p className="text-muted-foreground mt-1 text-sm">
            {user.name || "No name provided"} • Joined {format(new Date(user.createdAt), "MMM d, yyyy")}
          </p>
        </div>
        
        <div className="ml-auto">
          {user.status === 'active' ? (
            <Button onClick={() => handleUpdateStatus('suspended')} variant="outline" className="text-destructive border-destructive hover:bg-destructive/10">
              <Ban className="w-4 h-4 mr-2" /> Suspend Account
            </Button>
          ) : (
            <Button onClick={() => handleUpdateStatus('active')} variant="outline" className="text-success border-success hover:bg-success/10">
              <CheckCircle2 className="w-4 h-4 mr-2" /> Reactivate Account
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Wallet & Stats */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Financial Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 bg-card-border rounded-lg border border-border">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Wallet Balance</p>
                <p className="text-2xl font-bold font-mono text-primary flex items-center">
                  <IndianRupee className="w-5 h-5 mr-1" />
                  {user.walletBalance.toLocaleString()}
                </p>
              </div>
              <div className="p-4 bg-card-border rounded-lg border border-border">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Total Predictions</p>
                <p className="text-2xl font-bold font-mono flex items-center">
                  <Target className="w-5 h-5 mr-2 text-muted-foreground" />
                  {user.totalPredictions || 0}
                </p>
              </div>
              <div className="p-4 bg-card-border rounded-lg border border-border">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Amount Bet</p>
                <p className="text-xl font-bold font-mono text-muted-foreground">₹{user.totalAmountBet?.toLocaleString() || 0}</p>
              </div>
              <div className="p-4 bg-card-border rounded-lg border border-border">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Amount Won</p>
                <p className="text-xl font-bold font-mono text-success">₹{user.totalAmountWon?.toLocaleString() || 0}</p>
              </div>
            </div>

            <div className="mt-8">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Win/Loss Record</h3>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-success">
                  <TrendingUp className="w-5 h-5" />
                  <span className="font-bold text-xl">{user.totalWon || 0}</span> Won
                </div>
                <div className="w-px h-8 bg-border"></div>
                <div className="flex items-center gap-2 text-destructive">
                  <TrendingDown className="w-5 h-5" />
                  <span className="font-bold text-xl">{user.totalLost || 0}</span> Lost
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KYC & Identity */}
        <Card>
          <CardHeader>
            <CardTitle>Identity & KYC</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">KYC Status</p>
              {user.kycStatus === 'verified' ? (
                <div className="flex items-center text-blue-400 bg-blue-400/10 border border-blue-400/20 p-3 rounded-md">
                  <ShieldCheck className="w-5 h-5 mr-3" />
                  <div>
                    <p className="font-semibold text-sm">Verified</p>
                    <p className="text-xs opacity-80">User can withdraw funds</p>
                  </div>
                </div>
              ) : user.kycStatus === 'rejected' ? (
                <div className="flex items-center text-destructive bg-destructive/10 border border-destructive/20 p-3 rounded-md">
                  <ShieldAlert className="w-5 h-5 mr-3" />
                  <div>
                    <p className="font-semibold text-sm">Rejected</p>
                    <p className="text-xs opacity-80">Documents invalid</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center text-warning bg-warning/10 border border-warning/20 p-3 rounded-md">
                  <ShieldAlert className="w-5 h-5 mr-3" />
                  <div>
                    <p className="font-semibold text-sm">Pending Review</p>
                    <p className="text-xs opacity-80">Awaiting document upload</p>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-3 pt-4 border-t border-border">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">User ID</span>
                <span className="font-mono text-xs text-white">{user.id}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Role</span>
                <span className="uppercase text-xs font-bold text-primary">{user.role}</span>
              </div>
            </div>

            {user.kycStatus === 'pending' && (
              <div className="pt-4 flex gap-2">
                <Button onClick={() => handleUpdateKyc('verified')} className="flex-1 bg-blue-600 hover:bg-blue-700">Approve KYC</Button>
                <Button onClick={() => handleUpdateKyc('rejected')} variant="outline" className="flex-1 text-destructive hover:bg-destructive/10">Reject</Button>
              </div>
            )}
            {user.kycStatus === 'rejected' && (
              <div className="pt-4 flex gap-2">
                <Button onClick={() => handleUpdateKyc('verified')} variant="outline" className="w-full text-blue-400 border-blue-400 hover:bg-blue-400/10">Override & Approve</Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
