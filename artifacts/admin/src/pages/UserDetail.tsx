import { useState } from "react";
import { useParams, Link } from "wouter";
import {
  useGetUser, useUpdateUser, getGetUserQueryKey,
  useAdminGetUserDeposits, getAdminGetUserDepositsQueryKey,
  useAdminGetUserWithdrawals, getAdminGetUserWithdrawalsQueryKey,
  useAdminAdjustWallet,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Loader2, ArrowLeft, ShieldAlert, ShieldCheck, Ban, CheckCircle2,
  IndianRupee, TrendingUp, TrendingDown, Target, Plus, Minus,
  CreditCard, Building2, Phone, AlertCircle, ChevronLeft, ChevronRight,
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

type UserTab = "overview" | "deposits" | "withdrawals";

const STATUS_COLOR: Record<string, string> = {
  pending: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30",
  approved: "text-green-400 bg-green-400/10 border-green-400/30",
  rejected: "text-red-400 bg-red-400/10 border-red-400/30",
};

export function UserDetail() {
  const { userId } = useParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<UserTab>("overview");
  const [depPage, setDepPage] = useState(1);
  const [wdPage, setWdPage] = useState(1);

  // Wallet adjust form
  const [adjType, setAdjType] = useState<"credit" | "debit">("credit");
  const [adjAmount, setAdjAmount] = useState("");
  const [adjReason, setAdjReason] = useState("");
  const [adjConfirm, setAdjConfirm] = useState(false);

  const { data: user, isLoading } = useGetUser(userId as string, {
    query: { enabled: !!userId, queryKey: getGetUserQueryKey(userId as string) },
  });

  const { data: depositsData, isLoading: depLoading } = useAdminGetUserDeposits(
    userId as string,
    { page: depPage, limit: 10 },
    { query: { enabled: !!userId && activeTab === "deposits", queryKey: getAdminGetUserDepositsQueryKey(userId as string, { page: depPage, limit: 10 }) } }
  );

  const { data: withdrawalsData, isLoading: wdLoading } = useAdminGetUserWithdrawals(
    userId as string,
    { page: wdPage, limit: 10 },
    { query: { enabled: !!userId && activeTab === "withdrawals", queryKey: getAdminGetUserWithdrawalsQueryKey(userId as string, { page: wdPage, limit: 10 }) } }
  );

  const updateUser = useUpdateUser();
  const adjustWallet = useAdminAdjustWallet();

  const handleUpdateKyc = (status: "verified" | "rejected") => {
    if (!userId) return;
    updateUser.mutate({ userId, data: { kycStatus: status } }, {
      onSuccess: () => {
        toast({ title: `KYC marked as ${status}` });
        queryClient.invalidateQueries({ queryKey: getGetUserQueryKey(userId) });
      },
    });
  };

  const handleUpdateStatus = (status: "active" | "suspended") => {
    if (!userId) return;
    if (status === "suspended" && !confirm("Suspend this user? They won't be able to log in or place bets.")) return;
    updateUser.mutate({ userId, data: { status } }, {
      onSuccess: () => {
        toast({ title: `Account ${status === "active" ? "activated" : "suspended"}` });
        queryClient.invalidateQueries({ queryKey: getGetUserQueryKey(userId) });
      },
    });
  };

  const handleAdjust = () => {
    const amt = parseFloat(adjAmount);
    if (!amt || amt < 1) { toast({ variant: "destructive", title: "Enter a valid amount (min ₹1)" }); return; }
    if (!adjReason.trim()) { toast({ variant: "destructive", title: "Reason is required" }); return; }
    if (!adjConfirm) { toast({ variant: "destructive", title: "Check the confirmation box" }); return; }

    adjustWallet.mutate(
      { userId: userId as string, data: { type: adjType, amount: amt, reason: adjReason.trim() } },
      {
        onSuccess: (res) => {
          toast({
            title: `Wallet ${adjType}ed ✓`,
            description: `₹${amt.toFixed(0)} ${adjType}ed. New balance: ₹${res.balanceAfter.toFixed(0)}`,
          });
          setAdjAmount("");
          setAdjReason("");
          setAdjConfirm(false);
          queryClient.invalidateQueries({ queryKey: getGetUserQueryKey(userId as string) });
        },
        onError: (err: any) =>
          toast({ variant: "destructive", title: "Failed", description: err?.message }),
      }
    );
  };

  if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!user) return <div>User not found</div>;

  const tabs: { id: UserTab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "deposits", label: "Deposits" },
    { id: "withdrawals", label: "Withdrawals" },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/users">
          <Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5" /></Button>
        </Link>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-white font-mono">{user.phone}</h1>
            {user.status === "active" ? (
              <Badge variant="outline" className="text-green-400 border-green-400/30 bg-green-400/10">Active</Badge>
            ) : (
              <Badge variant="destructive">Suspended</Badge>
            )}
          </div>
          <p className="text-muted-foreground mt-1 text-sm">
            {user.name || "No name"} • Joined {format(new Date(user.createdAt), "MMM d, yyyy")}
          </p>
        </div>
        <div className="ml-auto flex gap-2">
          {user.status === "active" ? (
            <Button onClick={() => handleUpdateStatus("suspended")} variant="outline" className="text-destructive border-destructive hover:bg-destructive/10">
              <Ban className="w-4 h-4 mr-2" /> Suspend
            </Button>
          ) : (
            <Button onClick={() => handleUpdateStatus("active")} variant="outline" className="text-green-400 border-green-400 hover:bg-green-400/10">
              <CheckCircle2 className="w-4 h-4 mr-2" /> Reactivate
            </Button>
          )}
        </div>
      </div>

      {/* Wallet balance hero */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Wallet Balance", value: `₹${user.walletBalance.toLocaleString()}`, icon: IndianRupee, color: "text-primary" },
          { label: "Total Predictions", value: (user as any).totalPredictions ?? 0, icon: Target, color: "text-blue-400" },
          { label: "Won", value: (user as any).totalWon ?? 0, icon: TrendingUp, color: "text-green-400" },
          { label: "Lost", value: (user as any).totalLost ?? 0, icon: TrendingDown, color: "text-red-400" },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <stat.icon className={`w-8 h-8 ${stat.color} flex-shrink-0`} />
              <div>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
                <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === t.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ── */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* ── Manual Wallet Adjustment ── */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <IndianRupee className="w-5 h-5 text-primary" />
                Manual Wallet Adjustment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Credit / Debit toggle */}
              <div className="flex gap-2">
                <button
                  onClick={() => setAdjType("credit")}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                    adjType === "credit"
                      ? "bg-green-500/15 border-green-500/50 text-green-400"
                      : "border-border text-muted-foreground hover:border-green-500/30"
                  }`}
                >
                  <Plus className="w-4 h-4" /> Credit
                </button>
                <button
                  onClick={() => setAdjType("debit")}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                    adjType === "debit"
                      ? "bg-red-500/15 border-red-500/50 text-red-400"
                      : "border-border text-muted-foreground hover:border-red-500/30"
                  }`}
                >
                  <Minus className="w-4 h-4" /> Debit
                </button>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Amount (₹)</label>
                <Input
                  type="number"
                  min={1}
                  value={adjAmount}
                  onChange={(e) => setAdjAmount(e.target.value)}
                  placeholder="e.g. 500"
                  className="font-mono text-lg"
                />
                {/* Quick amounts */}
                <div className="flex gap-2 flex-wrap">
                  {[100, 500, 1000, 5000].map((a) => (
                    <button key={a} onClick={() => setAdjAmount(String(a))}
                      className="text-xs px-2.5 py-1 rounded border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors">
                      ₹{a}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Reason <span className="text-destructive">*</span></label>
                <Input
                  value={adjReason}
                  onChange={(e) => setAdjReason(e.target.value)}
                  placeholder="e.g. Bonus, Correction, Refund…"
                />
              </div>

              {/* Preview */}
              {adjAmount && parseFloat(adjAmount) > 0 && (
                <div className={`flex items-center justify-between p-3 rounded-lg border text-sm ${
                  adjType === "credit" ? "border-green-500/30 bg-green-500/10" : "border-red-500/30 bg-red-500/10"
                }`}>
                  <span className="text-muted-foreground">Balance after:</span>
                  <span className={`font-bold font-mono ${adjType === "credit" ? "text-green-400" : "text-red-400"}`}>
                    ₹{Math.max(0, user.walletBalance + (adjType === "credit" ? 1 : -1) * parseFloat(adjAmount || "0")).toLocaleString()}
                  </span>
                </div>
              )}

              {/* Confirmation */}
              <label className="flex items-start gap-2 cursor-pointer select-none">
                <input type="checkbox" checked={adjConfirm} onChange={(e) => setAdjConfirm(e.target.checked)} className="mt-0.5 accent-primary" />
                <span className="text-xs text-muted-foreground leading-relaxed">
                  I confirm: {adjType === "credit" ? "credit" : "debit"} ₹{adjAmount || "—"} from {user.phone}'s wallet.
                  This action is logged and cannot be undone.
                </span>
              </label>

              <Button
                onClick={handleAdjust}
                disabled={adjustWallet.isPending || !adjAmount || !adjReason.trim() || !adjConfirm}
                className={`w-full ${adjType === "credit" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}`}
              >
                {adjustWallet.isPending ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing…</>
                ) : (
                  <>{adjType === "credit" ? <Plus className="w-4 h-4 mr-2" /> : <Minus className="w-4 h-4 mr-2" />}
                    {adjType === "credit" ? "Credit" : "Debit"} ₹{adjAmount || "—"}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* ── Account Info + KYC ── */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Account Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {[
                  { label: "User ID", value: user.id, mono: true },
                  { label: "Phone", value: user.phone, mono: true },
                  { label: "Name", value: user.name ?? "—" },
                  { label: "Role", value: user.role.toUpperCase() },
                  { label: "Status", value: user.status },
                  { label: "Joined", value: format(new Date(user.createdAt), "MMM d, yyyy HH:mm") },
                ].map(({ label, value, mono }) => (
                  <div key={label} className="flex justify-between items-center gap-4">
                    <span className="text-muted-foreground shrink-0">{label}</span>
                    <span className={`text-white truncate text-right ${mono ? "font-mono text-xs" : ""}`}>{value}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  {user.kycStatus === "verified" ? (
                    <ShieldCheck className="w-5 h-5 text-blue-400" />
                  ) : (
                    <ShieldAlert className="w-5 h-5 text-yellow-400" />
                  )}
                  KYC Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border ${
                  user.kycStatus === "verified"
                    ? "text-blue-400 bg-blue-400/10 border-blue-400/30"
                    : user.kycStatus === "rejected"
                    ? "text-red-400 bg-red-400/10 border-red-400/30"
                    : "text-yellow-400 bg-yellow-400/10 border-yellow-400/30"
                }`}>
                  {user.kycStatus === "verified" ? <ShieldCheck className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}
                  {user.kycStatus.charAt(0).toUpperCase() + user.kycStatus.slice(1)}
                </div>
                {user.kycStatus === "pending" && (
                  <div className="flex gap-2 pt-1">
                    <Button onClick={() => handleUpdateKyc("verified")} size="sm" className="flex-1 bg-blue-600 hover:bg-blue-700">Approve KYC</Button>
                    <Button onClick={() => handleUpdateKyc("rejected")} size="sm" variant="outline" className="flex-1 text-destructive hover:bg-destructive/10">Reject</Button>
                  </div>
                )}
                {user.kycStatus === "rejected" && (
                  <Button onClick={() => handleUpdateKyc("verified")} size="sm" variant="outline" className="w-full text-blue-400 border-blue-400 hover:bg-blue-400/10">Override & Approve</Button>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ── DEPOSITS TAB ── */}
      {activeTab === "deposits" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-400" />
              Deposit History
              {depositsData && <span className="ml-auto text-sm font-normal text-muted-foreground">{depositsData.total} total</span>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {depLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
            ) : !depositsData?.deposits.length ? (
              <p className="text-center text-muted-foreground py-8">No deposits yet</p>
            ) : (
              <div className="space-y-0">
                {/* Header */}
                <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-3 pb-2 text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                  <span>Date</span><span>Amount</span><span>Method</span><span>Status</span>
                </div>
                {depositsData.deposits.map((dep: any) => (
                  <div key={dep.id} className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-3 py-3 border-b border-border/50 text-sm hover:bg-muted/30 transition-colors">
                    <div>
                      <p className="text-white">{format(new Date(dep.createdAt), "MMM d, yyyy")}</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(dep.createdAt), "HH:mm")}</p>
                      {dep.utrNumber && <p className="text-xs text-muted-foreground font-mono mt-0.5">UTR: {dep.utrNumber}</p>}
                    </div>
                    <span className="font-mono font-bold text-green-400 self-center">₹{Number(dep.amount).toLocaleString()}</span>
                    <span className="text-muted-foreground self-center capitalize">{dep.method === "upi_deeplink" ? "UPI" : "Manual"}</span>
                    <span className={`self-center text-xs font-medium px-2 py-0.5 rounded-full border ${STATUS_COLOR[dep.status] ?? ""}`}>
                      {dep.status.charAt(0).toUpperCase() + dep.status.slice(1)}
                    </span>
                  </div>
                ))}
                {/* Pagination */}
                {depositsData.total > 10 && (
                  <div className="flex items-center justify-between pt-4">
                    <p className="text-xs text-muted-foreground">Page {depPage} of {Math.ceil(depositsData.total / 10)}</p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="icon" disabled={depPage === 1} onClick={() => setDepPage(p => p - 1)}><ChevronLeft className="w-4 h-4" /></Button>
                      <Button variant="outline" size="icon" disabled={depPage >= Math.ceil(depositsData.total / 10)} onClick={() => setDepPage(p => p + 1)}><ChevronRight className="w-4 h-4" /></Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── WITHDRAWALS TAB ── */}
      {activeTab === "withdrawals" && (
        <div className="space-y-6">
          {/* Payment methods extracted from withdrawal history */}
          {withdrawalsData && withdrawalsData.withdrawals.length > 0 && (
            <PaymentDetailsSummary withdrawals={withdrawalsData.withdrawals} />
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingDown className="w-5 h-5 text-red-400" />
                Withdrawal History
                {withdrawalsData && <span className="ml-auto text-sm font-normal text-muted-foreground">{withdrawalsData.total} total</span>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {wdLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
              ) : !withdrawalsData?.withdrawals.length ? (
                <p className="text-center text-muted-foreground py-8">No withdrawals yet</p>
              ) : (
                <div className="space-y-0">
                  <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-3 pb-2 text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                    <span>Date / Destination</span><span>Amount</span><span>Method</span><span>Status</span>
                  </div>
                  {withdrawalsData.withdrawals.map((wd: any) => (
                    <div key={wd.id} className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-3 py-3 border-b border-border/50 text-sm hover:bg-muted/30 transition-colors">
                      <div>
                        <p className="text-white">{format(new Date(wd.createdAt), "MMM d, yyyy")}</p>
                        <p className="text-xs text-muted-foreground">{format(new Date(wd.createdAt), "HH:mm")}</p>
                        {wd.upiId && <p className="text-xs font-mono text-primary mt-0.5">{wd.upiId}</p>}
                        {wd.bankAccount && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {wd.bankAccount.bankName} ••••{String(wd.bankAccount.accountNumber ?? "").slice(-4)}
                          </p>
                        )}
                        {wd.remarks && <p className="text-xs text-muted-foreground italic mt-0.5">{wd.remarks}</p>}
                      </div>
                      <span className="font-mono font-bold text-red-400 self-center">₹{Number(wd.amount).toLocaleString()}</span>
                      <span className="text-muted-foreground self-center capitalize">
                        {wd.upiId ? "UPI" : "Bank"}
                      </span>
                      <span className={`self-center text-xs font-medium px-2 py-0.5 rounded-full border ${STATUS_COLOR[wd.status] ?? ""}`}>
                        {wd.status.charAt(0).toUpperCase() + wd.status.slice(1)}
                      </span>
                    </div>
                  ))}
                  {withdrawalsData.total > 10 && (
                    <div className="flex items-center justify-between pt-4">
                      <p className="text-xs text-muted-foreground">Page {wdPage} of {Math.ceil(withdrawalsData.total / 10)}</p>
                      <div className="flex gap-2">
                        <Button variant="outline" size="icon" disabled={wdPage === 1} onClick={() => setWdPage(p => p - 1)}><ChevronLeft className="w-4 h-4" /></Button>
                        <Button variant="outline" size="icon" disabled={wdPage >= Math.ceil(withdrawalsData.total / 10)} onClick={() => setWdPage(p => p + 1)}><ChevronRight className="w-4 h-4" /></Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

// ── Payment Details Summary ───────────────────────────────────────────────────
function PaymentDetailsSummary({ withdrawals }: { withdrawals: any[] }) {
  // Extract unique UPI IDs and bank accounts
  const upiIds = [...new Set(withdrawals.filter((w) => w.upiId).map((w) => w.upiId as string))];
  const bankAccounts: any[] = [];
  const seenAccounts = new Set<string>();
  for (const w of withdrawals) {
    if (w.bankAccount?.accountNumber && !seenAccounts.has(w.bankAccount.accountNumber)) {
      seenAccounts.add(w.bankAccount.accountNumber);
      bankAccounts.push(w.bankAccount);
    }
  }

  if (!upiIds.length && !bankAccounts.length) return null;

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-primary" />
          Saved Payment Methods
          <span className="ml-auto text-xs font-normal text-muted-foreground">Extracted from withdrawal history</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {upiIds.map((id) => (
          <div key={id} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center">
              <Phone className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">UPI ID</p>
              <p className="font-mono text-sm text-white">{id}</p>
            </div>
          </div>
        ))}
        {bankAccounts.map((ba, i) => (
          <div key={i} className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500/15 flex items-center justify-center">
              <Building2 className="w-4 h-4 text-blue-400" />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Bank Account</p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-0.5 text-sm">
                {ba.bankName && <><span className="text-muted-foreground">Bank</span><span className="text-white">{ba.bankName}</span></>}
                {ba.holderName && <><span className="text-muted-foreground">Holder</span><span className="text-white">{ba.holderName}</span></>}
                {ba.accountNumber && <><span className="text-muted-foreground">Account</span><span className="font-mono text-white">{ba.accountNumber}</span></>}
                {ba.ifsc && <><span className="text-muted-foreground">IFSC</span><span className="font-mono text-white">{ba.ifsc}</span></>}
              </div>
            </div>
          </div>
        ))}
        {!upiIds.length && !bankAccounts.length && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertCircle className="w-4 h-4" />
            No payment methods found in withdrawal history.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
