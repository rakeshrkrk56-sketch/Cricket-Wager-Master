import { useState } from "react";
import { useParams, Link } from "wouter";
import {
  useGetUser, useUpdateUser, getGetUserQueryKey,
  useAdminGetUserDeposits, getAdminGetUserDepositsQueryKey,
  useAdminGetUserWithdrawals, getAdminGetUserWithdrawalsQueryKey,
  useAdminAdjustWallet,
} from "@workspace/api-client-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Loader2, ArrowLeft, ShieldAlert, ShieldCheck, Ban, CheckCircle2,
  IndianRupee, TrendingUp, TrendingDown, Target, Plus, Minus,
  CreditCard, Building2, Phone, AlertCircle, ChevronLeft, ChevronRight,
  Pause, FileText, Clock, Trash2, StickyNote, Shield, Image, Send,
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useAdminFetch } from "@/hooks/useAdminFetch";

type UserTab = "overview" | "deposits" | "withdrawals" | "timeline" | "audit";

const STATUS_COLOR: Record<string, string> = {
  pending: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30",
  approved: "text-green-400 bg-green-400/10 border-green-400/30",
  rejected: "text-red-400 bg-red-400/10 border-red-400/30",
  more_info_requested: "text-blue-400 bg-blue-400/10 border-blue-400/30",
};

const DOC_TYPE_LABELS: Record<string, string> = {
  govt_id: "Government ID",
  selfie: "Selfie",
  address_proof: "Address Proof",
  other: "Other Document",
};

export function UserDetail() {
  const { userId } = useParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const adminFetch = useAdminFetch();

  const [activeTab, setActiveTab] = useState<UserTab>("overview");
  const [depPage, setDepPage] = useState(1);
  const [wdPage, setWdPage] = useState(1);

  // Wallet adjust form
  const [adjType, setAdjType] = useState<"credit" | "debit">("credit");
  const [adjAmount, setAdjAmount] = useState("");
  const [adjReason, setAdjReason] = useState("");
  const [adjConfirm, setAdjConfirm] = useState(false);

  // Suspend modal
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [suspendReason, setSuspendReason] = useState("");

  // Admin note form
  const [noteText, setNoteText] = useState("");

  // KYC review state
  const [kycAdminNote, setKycAdminNote] = useState<Record<string, string>>({});

  // Delete confirm
  const [deleteConfirm, setDeleteConfirm] = useState(false);

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

  const { data: kycData, isLoading: kycLoading, refetch: refetchKyc } = useQuery({
    queryKey: ["kyc-documents", userId],
    queryFn: () => adminFetch(`/api/admin/users/${userId}/kyc-documents`),
    enabled: !!userId,
  });

  const { data: notesData, isLoading: notesLoading, refetch: refetchNotes } = useQuery({
    queryKey: ["admin-notes", userId],
    queryFn: () => adminFetch(`/api/admin/users/${userId}/notes`),
    enabled: !!userId,
  });

  const { data: timelineData, isLoading: timelineLoading } = useQuery({
    queryKey: ["timeline", userId],
    queryFn: () => adminFetch(`/api/admin/users/${userId}/timeline`),
    enabled: !!userId && activeTab === "timeline",
  });

  const { data: auditData, isLoading: auditLoading } = useQuery({
    queryKey: ["audit-user", userId],
    queryFn: () => adminFetch(`/api/admin/audit-logs?userId=${userId}&limit=100`),
    enabled: !!userId && activeTab === "audit",
  });

  const updateUser = useUpdateUser();
  const adjustWallet = useAdminAdjustWallet();

  const addNoteMutation = useMutation({
    mutationFn: (note: string) => adminFetch(`/api/admin/users/${userId}/notes`, {
      method: "POST",
      body: JSON.stringify({ note }),
    }),
    onSuccess: () => { refetchNotes(); setNoteText(""); toast({ title: "Note saved" }); },
    onError: (e: any) => toast({ variant: "destructive", title: e.message }),
  });

  const deleteNoteMutation = useMutation({
    mutationFn: (noteId: string) => adminFetch(`/api/admin/users/${userId}/notes/${noteId}`, { method: "DELETE" }),
    onSuccess: () => { refetchNotes(); toast({ title: "Note deleted" }); },
    onError: (e: any) => toast({ variant: "destructive", title: e.message }),
  });

  const reviewKycMutation = useMutation({
    mutationFn: ({ docId, status, adminNote }: { docId: string; status: string; adminNote?: string }) =>
      adminFetch(`/api/admin/kyc-documents/${docId}`, {
        method: "PATCH",
        body: JSON.stringify({ status, adminNote }),
      }),
    onSuccess: () => { refetchKyc(); toast({ title: "KYC document updated" }); },
    onError: (e: any) => toast({ variant: "destructive", title: e.message }),
  });

  const deleteUserMutation = useMutation({
    mutationFn: () => adminFetch(`/api/admin/users/${userId}`, { method: "DELETE" }),
    onSuccess: () => { toast({ title: "User permanently deleted" }); window.location.href = "/users"; },
    onError: (e: any) => toast({ variant: "destructive", title: e.message }),
  });

  const handleUpdateKyc = (status: "verified" | "rejected") => {
    if (!userId) return;
    updateUser.mutate({ userId, data: { kycStatus: status } }, {
      onSuccess: () => {
        toast({ title: `KYC marked as ${status}` });
        queryClient.invalidateQueries({ queryKey: getGetUserQueryKey(userId) });
      },
    });
  };

  const handleHold = () => {
    if (!userId || !confirm("Place this account on Hold? The user can still log in, deposit, and predict — but cannot withdraw.")) return;
    updateUser.mutate({ userId, data: { status: "hold" } as any }, {
      onSuccess: () => {
        toast({ title: "Account placed on Hold" });
        queryClient.invalidateQueries({ queryKey: getGetUserQueryKey(userId) });
      },
      onError: (e: any) => toast({ variant: "destructive", title: e.message }),
    });
  };

  const handleSuspend = () => {
    if (!userId || !suspendReason.trim()) return;
    updateUser.mutate({ userId, data: { status: "suspended", suspensionReason: suspendReason.trim() } as any }, {
      onSuccess: () => {
        toast({ title: "Account suspended" });
        setSuspendOpen(false);
        setSuspendReason("");
        queryClient.invalidateQueries({ queryKey: getGetUserQueryKey(userId) });
      },
      onError: (e: any) => toast({ variant: "destructive", title: e.message }),
    });
  };

  const handleRestore = () => {
    if (!userId || !confirm("Restore this account to Active? All permissions will be re-enabled.")) return;
    updateUser.mutate({ userId, data: { status: "active" } as any }, {
      onSuccess: () => {
        toast({ title: "Account restored" });
        queryClient.invalidateQueries({ queryKey: getGetUserQueryKey(userId) });
      },
      onError: (e: any) => toast({ variant: "destructive", title: e.message }),
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
          toast({ title: `Wallet ${adjType}ed ✓`, description: `₹${amt.toFixed(0)} ${adjType}ed. Balance: ₹${res.balanceAfter.toFixed(0)}` });
          setAdjAmount(""); setAdjReason(""); setAdjConfirm(false);
          queryClient.invalidateQueries({ queryKey: getGetUserQueryKey(userId as string) });
        },
        onError: (err: any) => toast({ variant: "destructive", title: "Failed", description: err?.message }),
      }
    );
  };

  if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  if (!user) return <div>User not found</div>;

  const status = (user as any).status as string;
  const tabs: { id: UserTab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "deposits", label: "Deposits" },
    { id: "withdrawals", label: "Withdrawals" },
    { id: "timeline", label: "Activity" },
    { id: "audit", label: "Audit Log" },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Link href="/users">
          <Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5" /></Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-3xl font-bold tracking-tight text-white font-mono">{user.phone}</h1>
            {status === "active" && <Badge variant="outline" className="text-green-400 border-green-400/30 bg-green-400/10">Active</Badge>}
            {status === "hold" && <Badge variant="outline" className="text-yellow-400 border-yellow-400/30 bg-yellow-400/10">On Hold</Badge>}
            {status === "suspended" && <Badge variant="destructive">Suspended</Badge>}
          </div>
          <p className="text-muted-foreground mt-1 text-sm">
            {user.name || "No name"} • Joined {format(new Date(user.createdAt), "MMM d, yyyy")}
          </p>
          {status === "suspended" && (user as any).suspensionReason && (
            <p className="text-xs text-red-400 mt-1 italic">Reason: {(user as any).suspensionReason}</p>
          )}
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          {status === "active" && (
            <>
              <Button onClick={handleHold} variant="outline" size="sm" className="text-yellow-400 border-yellow-400/40 hover:bg-yellow-400/10">
                <Pause className="w-4 h-4 mr-1.5" /> Hold
              </Button>
              <Button onClick={() => setSuspendOpen(true)} variant="outline" size="sm" className="text-destructive border-destructive hover:bg-destructive/10">
                <Ban className="w-4 h-4 mr-1.5" /> Suspend
              </Button>
            </>
          )}
          {status === "hold" && (
            <>
              <Button onClick={() => setSuspendOpen(true)} variant="outline" size="sm" className="text-destructive border-destructive hover:bg-destructive/10">
                <Ban className="w-4 h-4 mr-1.5" /> Suspend
              </Button>
              <Button onClick={handleRestore} variant="outline" size="sm" className="text-green-400 border-green-400 hover:bg-green-400/10">
                <CheckCircle2 className="w-4 h-4 mr-1.5" /> Restore
              </Button>
            </>
          )}
          {status === "suspended" && (
            <Button onClick={handleRestore} variant="outline" size="sm" className="text-green-400 border-green-400 hover:bg-green-400/10">
              <CheckCircle2 className="w-4 h-4 mr-1.5" /> Restore
            </Button>
          )}
        </div>
      </div>

      {/* Suspend dialog */}
      {suspendOpen && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="p-4 space-y-3">
            <p className="text-sm font-medium text-destructive flex items-center gap-2"><Ban className="w-4 h-4" /> Suspension Reason (required)</p>
            <Input
              placeholder="e.g. Fraudulent activity, multiple accounts…"
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
              className="border-destructive/40"
              autoFocus
            />
            <div className="flex gap-2">
              <Button onClick={handleSuspend} disabled={!suspendReason.trim() || updateUser.isPending} className="bg-destructive hover:bg-destructive/90" size="sm">
                {updateUser.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Ban className="w-4 h-4 mr-1.5" /> Confirm Suspend</>}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { setSuspendOpen(false); setSuspendReason(""); }}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
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
      <div className="flex gap-1 border-b border-border overflow-x-auto">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap ${
              activeTab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ── */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Exceptional Wallet Adjustment */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><IndianRupee className="w-5 h-5 text-primary" /> Exceptional Wallet Adjustment</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Use only for bonuses, refunds, or corrections. Approve normal user payments from the Deposits page.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  {(["credit", "debit"] as const).map((t) => (
                    <button key={t} onClick={() => setAdjType(t)}
                      className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                        adjType === t
                          ? t === "credit" ? "bg-green-500/15 border-green-500/50 text-green-400" : "bg-red-500/15 border-red-500/50 text-red-400"
                          : "border-border text-muted-foreground"
                      }`}>
                      {t === "credit" ? <Plus className="w-4 h-4" /> : <Minus className="w-4 h-4" />} {t === "credit" ? "Credit" : "Debit"}
                    </button>
                  ))}
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Amount (₹)</label>
                  <Input type="number" min={1} value={adjAmount} onChange={(e) => setAdjAmount(e.target.value)} placeholder="e.g. 500" className="font-mono text-lg" />
                  <div className="flex gap-2 flex-wrap">
                    {[100, 500, 1000, 5000].map((a) => (
                      <button key={a} onClick={() => setAdjAmount(String(a))} className="text-xs px-2.5 py-1 rounded border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors">₹{a}</button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Reason <span className="text-destructive">*</span></label>
                  <Input value={adjReason} onChange={(e) => setAdjReason(e.target.value)} placeholder="e.g. Bonus, Correction, Refund…" />
                </div>
                {adjAmount && parseFloat(adjAmount) > 0 && (
                  <div className={`flex items-center justify-between p-3 rounded-lg border text-sm ${adjType === "credit" ? "border-green-500/30 bg-green-500/10" : "border-red-500/30 bg-red-500/10"}`}>
                    <span className="text-muted-foreground">Balance after:</span>
                    <span className={`font-bold font-mono ${adjType === "credit" ? "text-green-400" : "text-red-400"}`}>
                      ₹{Math.max(0, user.walletBalance + (adjType === "credit" ? 1 : -1) * parseFloat(adjAmount || "0")).toLocaleString()}
                    </span>
                  </div>
                )}
                <label className="flex items-start gap-2 cursor-pointer select-none">
                  <input type="checkbox" checked={adjConfirm} onChange={(e) => setAdjConfirm(e.target.checked)} className="mt-0.5 accent-primary" />
                  <span className="text-xs text-muted-foreground leading-relaxed">I confirm: {adjType} ₹{adjAmount || "—"} from {user.phone}'s wallet.</span>
                </label>
                <Button onClick={handleAdjust} disabled={adjustWallet.isPending || !adjAmount || !adjReason.trim() || !adjConfirm}
                  className={`w-full ${adjType === "credit" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}`}>
                  {adjustWallet.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : (adjType === "credit" ? <Plus className="w-4 h-4 mr-2" /> : <Minus className="w-4 h-4 mr-2" />)}
                  {adjType === "credit" ? "Credit" : "Debit"} ₹{adjAmount || "—"}
                </Button>
              </CardContent>
            </Card>

            {/* Account Info + KYC */}
            <div className="space-y-4">
              <Card>
                <CardHeader><CardTitle className="text-base">Account Info</CardTitle></CardHeader>
                <CardContent className="space-y-3 text-sm">
                  {[
                    { label: "User ID", value: user.id, mono: true },
                    { label: "Phone", value: user.phone, mono: true },
                    { label: "Name", value: user.name ?? "—" },
                    { label: "Role", value: user.role.toUpperCase() },
                    { label: "Status", value: status },
                    { label: "Joined", value: format(new Date(user.createdAt), "MMM d, yyyy HH:mm") },
                  ].map(({ label, value, mono }) => (
                    <div key={label} className="flex justify-between items-center gap-4">
                      <span className="text-muted-foreground shrink-0">{label}</span>
                      <span className={`text-white truncate text-right ${mono ? "font-mono text-xs" : ""}`}>{value}</span>
                    </div>
                  ))}
                  {status === "suspended" && (user as any).suspensionReason && (
                    <div className="pt-1 border-t border-border">
                      <p className="text-xs text-muted-foreground">Suspension Reason</p>
                      <p className="text-xs text-red-400 mt-0.5 italic">{(user as any).suspensionReason}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    {user.kycStatus === "verified" ? <ShieldCheck className="w-5 h-5 text-blue-400" /> : <ShieldAlert className="w-5 h-5 text-yellow-400" />}
                    KYC Status
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border ${
                    user.kycStatus === "verified" ? "text-blue-400 bg-blue-400/10 border-blue-400/30"
                      : user.kycStatus === "rejected" ? "text-red-400 bg-red-400/10 border-red-400/30"
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

          {/* KYC Documents */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Image className="w-5 h-5 text-blue-400" /> KYC Documents
                {kycLoading && <Loader2 className="w-4 h-4 animate-spin ml-1 text-muted-foreground" />}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!kycData?.documents?.length ? (
                <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>
              ) : (
                <div className="space-y-4">
                  {kycData.documents.map((doc: any) => (
                    <div key={doc.id} className="border border-border rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-white">{DOC_TYPE_LABELS[doc.docType] ?? doc.docType}</p>
                          {doc.label && <p className="text-xs text-muted-foreground">{doc.label}</p>}
                          <p className="text-xs text-muted-foreground">{format(new Date(doc.createdAt), "MMM d, yyyy HH:mm")}</p>
                        </div>
                        <Badge variant="outline" className={STATUS_COLOR[doc.status] ?? ""}>
                          {doc.status.replace(/_/g, " ")}
                        </Badge>
                      </div>
                      {doc.adminNote && (
                        <p className="text-xs text-muted-foreground italic border-l-2 border-border pl-2">{doc.adminNote}</p>
                      )}
                      <Input
                        placeholder="Admin note (optional)…"
                        value={kycAdminNote[doc.id] ?? ""}
                        onChange={(e) => setKycAdminNote(prev => ({ ...prev, [doc.id]: e.target.value }))}
                        className="text-xs h-8"
                      />
                      <div className="flex gap-2">
                        <Button size="sm" className="flex-1 bg-green-600 hover:bg-green-700 text-xs"
                          disabled={reviewKycMutation.isPending}
                          onClick={() => reviewKycMutation.mutate({ docId: doc.id, status: "approved", adminNote: kycAdminNote[doc.id] })}>
                          <CheckCircle2 className="w-3 h-3 mr-1" /> Approve
                        </Button>
                        <Button size="sm" variant="outline" className="flex-1 text-destructive text-xs"
                          disabled={reviewKycMutation.isPending}
                          onClick={() => reviewKycMutation.mutate({ docId: doc.id, status: "rejected", adminNote: kycAdminNote[doc.id] })}>
                          <Ban className="w-3 h-3 mr-1" /> Reject
                        </Button>
                        <Button size="sm" variant="outline" className="flex-1 text-blue-400 text-xs"
                          disabled={reviewKycMutation.isPending}
                          onClick={() => reviewKycMutation.mutate({ docId: doc.id, status: "more_info_requested", adminNote: kycAdminNote[doc.id] })}>
                          <FileText className="w-3 h-3 mr-1" /> More Info
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Admin Notes */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <StickyNote className="w-5 h-5 text-yellow-400" /> Private Admin Notes
                <span className="ml-auto text-xs font-normal text-muted-foreground">Visible only in admin panel</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Add a private note…"
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && noteText.trim()) { addNoteMutation.mutate(noteText); } }}
                />
                <Button onClick={() => addNoteMutation.mutate(noteText)} disabled={!noteText.trim() || addNoteMutation.isPending} size="icon">
                  {addNoteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </div>
              {notesLoading ? (
                <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
              ) : !notesData?.notes?.length ? (
                <p className="text-sm text-muted-foreground">No notes yet.</p>
              ) : (
                <div className="space-y-2">
                  {notesData.notes.map((n: any) => (
                    <div key={n.id} className="flex items-start gap-3 p-3 rounded-lg border border-border bg-muted/20">
                      <div className="flex-1">
                        <p className="text-sm text-white leading-relaxed">{n.note}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {n.admin?.phone ?? "Admin"} • {format(new Date(n.createdAt), "MMM d, yyyy HH:mm")}
                        </p>
                      </div>
                      <button onClick={() => deleteNoteMutation.mutate(n.id)} className="text-muted-foreground hover:text-destructive transition-colors mt-0.5">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── DEPOSITS TAB ── */}
      {activeTab === "deposits" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-400" /> Deposit History
              {depositsData && <span className="ml-auto text-sm font-normal text-muted-foreground">{depositsData.total} total</span>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {depLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
            ) : !depositsData?.deposits.length ? (
              <p className="text-center text-muted-foreground py-8">No deposits yet</p>
            ) : (
              <div>
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
          {withdrawalsData && withdrawalsData.withdrawals.length > 0 && (
            <PaymentDetailsSummary withdrawals={withdrawalsData.withdrawals} />
          )}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingDown className="w-5 h-5 text-red-400" /> Withdrawal History
                {withdrawalsData && <span className="ml-auto text-sm font-normal text-muted-foreground">{withdrawalsData.total} total</span>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {wdLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
              ) : !withdrawalsData?.withdrawals.length ? (
                <p className="text-center text-muted-foreground py-8">No withdrawals yet</p>
              ) : (
                <div>
                  <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-3 pb-2 text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                    <span>Date / Destination</span><span>Amount</span><span>Method</span><span>Status</span>
                  </div>
                  {withdrawalsData.withdrawals.map((wd: any) => (
                    <div key={wd.id} className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-3 py-3 border-b border-border/50 text-sm hover:bg-muted/30 transition-colors">
                      <div>
                        <p className="text-white">{format(new Date(wd.createdAt), "MMM d, yyyy")}</p>
                        <p className="text-xs text-muted-foreground">{format(new Date(wd.createdAt), "HH:mm")}</p>
                        {wd.upiId && <p className="text-xs font-mono text-primary mt-0.5">{wd.upiId}</p>}
                        {wd.remarks && <p className="text-xs text-muted-foreground italic mt-0.5">{wd.remarks}</p>}
                      </div>
                      <span className="font-mono font-bold text-red-400 self-center">₹{Number(wd.amount).toLocaleString()}</span>
                      <span className="text-muted-foreground self-center capitalize">{wd.upiId ? "UPI" : "Bank"}</span>
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

      {/* ── ACTIVITY TIMELINE TAB ── */}
      {activeTab === "timeline" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" /> Activity Timeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            {timelineLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
            ) : !timelineData?.events?.length ? (
              <p className="text-center text-muted-foreground py-12">No activity recorded yet.</p>
            ) : (
              <div className="space-y-0">
                {timelineData.events.map((event: any, i: number) => (
                  <div key={event.id + i} className="flex gap-4 py-3 border-b border-border/50">
                    <div className="w-8 flex-shrink-0 flex flex-col items-center">
                      <div className={`w-2.5 h-2.5 rounded-full mt-1.5 ${
                        event.type === "login" ? "bg-green-400" :
                        event.type === "deposit" ? "bg-blue-400" :
                        event.type === "withdrawal" ? "bg-yellow-400" :
                        event.type === "kyc" ? "bg-cyan-400" :
                        event.type === "admin_action" ? "bg-red-400" :
                        "bg-muted-foreground"
                      }`} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm text-white">{event.label}</p>
                          {event.detail && (
                            <p className="text-xs text-muted-foreground capitalize">{event.detail}</p>
                          )}
                          {event.extra?.ip && <p className="text-xs text-muted-foreground font-mono">IP: {event.extra.ip}</p>}
                          {event.extra?.admin && <p className="text-xs text-muted-foreground">By: {event.extra.admin?.phone}</p>}
                        </div>
                        <p className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                          {format(new Date(event.createdAt), "MMM d, HH:mm")}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── AUDIT LOG TAB ── */}
      {activeTab === "audit" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" /> Audit Log for This User
            </CardTitle>
          </CardHeader>
          <CardContent>
            {auditLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
            ) : !auditData?.logs?.length ? (
              <p className="text-center text-muted-foreground py-12">No admin actions recorded for this user.</p>
            ) : (
              <div className="space-y-0">
                {auditData.logs.map((log: any) => (
                  <div key={log.id} className="flex gap-4 py-3 border-b border-border/50">
                    <div className="flex-1">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <Badge variant="outline" className={`text-xs mb-1 ${
                            log.action.includes("suspend") ? "text-red-400 border-red-400/30" :
                            log.action.includes("hold") ? "text-yellow-400 border-yellow-400/30" :
                            log.action.includes("active") || log.action.includes("restored") ? "text-green-400 border-green-400/30" :
                            "text-muted-foreground border-border"
                          }`}>
                            {log.action.replace(/_/g, " ")}
                          </Badge>
                          {log.reason && <p className="text-xs text-muted-foreground">Reason: {log.reason}</p>}
                          {(log.prevStatus || log.newStatus) && (
                            <p className="text-xs text-muted-foreground">
                              {log.prevStatus && <span className="text-yellow-400">{log.prevStatus}</span>}
                              {log.prevStatus && log.newStatus && " → "}
                              {log.newStatus && <span className="text-green-400">{log.newStatus}</span>}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground mt-0.5">By: {log.admin?.phone ?? "—"}</p>
                        </div>
                        <p className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                          {format(new Date(log.createdAt), "MMM d, yyyy HH:mm")}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── PERMANENT DELETE ── */}
      <Card className="border-destructive/30 bg-destructive/5">
        <CardHeader>
          <CardTitle className="text-base text-destructive flex items-center gap-2">
            <Trash2 className="w-5 h-5" /> Danger Zone
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="p-3 rounded-lg border border-destructive/30 bg-destructive/5">
            <p className="text-sm font-medium text-destructive">⚠ Warning: This action permanently deletes the user account and cannot be undone.</p>
            <p className="text-xs text-muted-foreground mt-1">Wallet balance, transactions, and all user data will be permanently removed. This does not require the balance to be zero.</p>
          </div>
          {!deleteConfirm ? (
            <Button variant="outline" size="sm" className="text-destructive border-destructive/50 hover:bg-destructive/10"
              onClick={() => setDeleteConfirm(true)}>
              <Trash2 className="w-4 h-4 mr-2" /> Permanently Delete Account
            </Button>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-destructive font-medium">Are you absolutely sure? This cannot be undone.</p>
              <div className="flex gap-2">
                <Button className="bg-destructive hover:bg-destructive/90" size="sm"
                  disabled={deleteUserMutation.isPending}
                  onClick={() => deleteUserMutation.mutate()}>
                  {deleteUserMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Trash2 className="w-4 h-4 mr-1" />}
                  Yes, Delete Permanently
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setDeleteConfirm(false)}>Cancel</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function PaymentDetailsSummary({ withdrawals }: { withdrawals: any[] }) {
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
          <CreditCard className="w-5 h-5 text-primary" /> Saved Payment Methods
          <span className="ml-auto text-xs font-normal text-muted-foreground">Extracted from withdrawal history</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {upiIds.map((id) => (
          <div key={id} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center"><Phone className="w-4 h-4 text-primary" /></div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">UPI ID</p>
              <p className="font-mono text-sm text-white">{id}</p>
            </div>
          </div>
        ))}
        {bankAccounts.map((ba, i) => (
          <div key={i} className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500/15 flex items-center justify-center"><Building2 className="w-4 h-4 text-blue-400" /></div>
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
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><AlertCircle className="w-4 h-4" /> No payment methods found.</div>
        )}
      </CardContent>
    </Card>
  );
}
