import { useState } from "react";
import { useParams } from "wouter";
import {
  useAdminGetSupportTicket,
  useAdminReplyToTicket,
  useAdminUpdateTicketStatus,
} from "@workspace/api-client-react";
import { Link } from "wouter";
import {
  ArrowLeft, Send, User, Clock, CheckCircle, XCircle, AlertCircle,
  MessageSquare, Wallet, Shield
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  open: { label: "Open", color: "bg-amber-500/10 text-amber-400 border-amber-500/20", icon: AlertCircle },
  in_progress: { label: "In Progress", color: "bg-blue-500/10 text-blue-400 border-blue-500/20", icon: Clock },
  resolved: { label: "Resolved", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", icon: CheckCircle },
  closed: { label: "Closed", color: "bg-muted text-muted-foreground border-border", icon: XCircle },
};

const CATEGORY_LABELS: Record<string, string> = {
  deposit_issue: "Deposit Issue", withdrawal_issue: "Withdrawal Issue",
  prediction_issue: "Prediction Issue", kyc_issue: "KYC Issue",
  account_issue: "Account Issue", technical_problem: "Technical Problem", other: "Other",
};

const TX_TYPE_COLOR: Record<string, string> = {
  deposit: "text-emerald-400", withdraw: "text-red-400",
  win: "text-emerald-400", loss: "text-red-400", bonus: "text-blue-400", refund: "text-amber-400",
};

export function SupportDetail() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const { toast } = useToast();
  const [reply, setReply] = useState("");

  const { data, isLoading, refetch } = useAdminGetSupportTicket(ticketId ?? "");
  const replyMutation = useAdminReplyToTicket();
  const statusMutation = useAdminUpdateTicketStatus();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        Loading ticket…
      </div>
    );
  }

  if (!data) return null;

  const { ticket, messages, recentTransactions } = data;
  const user = (ticket as any).user;
  const cfg = STATUS_CONFIG[ticket.status] ?? STATUS_CONFIG.open;
  const StatusIcon = cfg.icon;

  const handleReply = async () => {
    if (!reply.trim()) return;
    try {
      await replyMutation.mutateAsync({ ticketId: ticket.id, data: { message: reply.trim() } });
      setReply("");
      refetch();
      toast({ title: "Reply sent", description: "The user has been notified." });
    } catch {
      toast({ title: "Error", description: "Failed to send reply.", variant: "destructive" });
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    try {
      await statusMutation.mutateAsync({ ticketId: ticket.id, data: { status: newStatus as any } });
      refetch();
      toast({ title: "Status updated", description: `Ticket is now ${newStatus.replace("_", " ")}.` });
    } catch {
      toast({ title: "Error", description: "Failed to update status.", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <div className="flex items-start gap-4">
        <Link href="/support">
          <Button variant="ghost" size="sm" className="text-muted-foreground -ml-2">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
        </Link>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white">{ticket.subject}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Ticket #{ticket.id.slice(0, 8)} · {CATEGORY_LABELS[ticket.category] ?? ticket.category}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={`${cfg.color} flex items-center gap-1`}>
            <StatusIcon className="w-3 h-3" />
            {cfg.label}
          </Badge>
          <Select value={ticket.status} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-40 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Messages — 2/3 width */}
        <div className="col-span-2 space-y-4">
          {/* Original description */}
          <div className="bg-card border border-border rounded-lg p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3 font-semibold">Original Report</p>
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{ticket.description}</p>
            <p className="text-xs text-muted-foreground mt-3">
              {new Date(ticket.createdAt).toLocaleString("en-IN")}
            </p>
          </div>

          {/* Conversation */}
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Conversation</p>
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 ${msg.isAdmin ? "flex-row-reverse" : ""}`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                  msg.isAdmin ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                }`}>
                  {msg.isAdmin ? "A" : "U"}
                </div>
                <div className={`max-w-[75%] rounded-xl p-3 ${
                  msg.isAdmin
                    ? "bg-primary/10 border border-primary/20"
                    : "bg-card border border-border"
                }`}>
                  <p className={`text-xs font-semibold mb-1 ${msg.isAdmin ? "text-primary" : "text-muted-foreground"}`}>
                    {msg.isAdmin ? (msg.senderId ? "Support Agent" : "Jazment Support") : "User"}
                  </p>
                  <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{msg.message}</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {new Date(msg.createdAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Reply box */}
          {ticket.status !== "closed" && (
            <div className="bg-card border border-border rounded-lg p-4 space-y-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Reply to User</p>
              <Textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Type your response…"
                className="min-h-[100px] resize-none"
              />
              <div className="flex justify-end gap-2">
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleReply}
                  disabled={!reply.trim() || replyMutation.isPending}
                >
                  <Send className="w-3.5 h-3.5 mr-1.5" />
                  {replyMutation.isPending ? "Sending…" : "Send Reply"}
                </Button>
              </div>
            </div>
          )}
          {ticket.status === "closed" && (
            <div className="bg-muted/30 border border-border rounded-lg p-4 text-center text-sm text-muted-foreground">
              This ticket is closed. Reopen it to reply.
            </div>
          )}
        </div>

        {/* Sidebar — 1/3 width */}
        <div className="space-y-4">
          {/* User details */}
          {user && (
            <div className="bg-card border border-border rounded-lg p-4 space-y-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" /> User Details
              </p>
              <div className="space-y-2">
                <div>
                  <p className="text-xs text-muted-foreground">Phone</p>
                  <p className="text-sm text-foreground font-medium">{user.phone}</p>
                </div>
                {user.name && (
                  <div>
                    <p className="text-xs text-muted-foreground">Name</p>
                    <p className="text-sm text-foreground">{user.name}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-muted-foreground">Wallet Balance</p>
                  <p className="text-sm text-foreground font-mono">₹{Number(user.walletBalance ?? 0).toFixed(2)}</p>
                </div>
                <div className="flex gap-2">
                  <Badge variant="outline" className={`text-xs ${user.status === "active" ? "text-emerald-400 border-emerald-500/20" : "text-red-400 border-red-500/20"}`}>
                    {user.status}
                  </Badge>
                  <Badge variant="outline" className="text-xs text-muted-foreground">
                    <Shield className="w-2.5 h-2.5 mr-1" />
                    KYC: {user.kycStatus}
                  </Badge>
                </div>
              </div>
              <Link href={`/users/${user.id}`}>
                <Button variant="outline" size="sm" className="w-full mt-2 text-xs">
                  View Full Profile →
                </Button>
              </Link>
            </div>
          )}

          {/* Ticket info */}
          <div className="bg-card border border-border rounded-lg p-4 space-y-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Ticket Info</p>
            <div>
              <p className="text-xs text-muted-foreground">Created</p>
              <p className="text-xs text-foreground">{new Date(ticket.createdAt).toLocaleString("en-IN")}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Last Updated</p>
              <p className="text-xs text-foreground">{new Date(ticket.updatedAt).toLocaleString("en-IN")}</p>
            </div>
            {ticket.resolvedAt && (
              <div>
                <p className="text-xs text-muted-foreground">Resolved At</p>
                <p className="text-xs text-foreground">{new Date(ticket.resolvedAt).toLocaleString("en-IN")}</p>
              </div>
            )}
          </div>

          {/* Recent transactions */}
          {recentTransactions && recentTransactions.length > 0 && (
            <div className="bg-card border border-border rounded-lg p-4 space-y-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold flex items-center gap-1.5">
                <Wallet className="w-3.5 h-3.5" /> Recent Transactions
              </p>
              <div className="space-y-2">
                {recentTransactions.map((tx: any) => (
                  <div key={tx.id} className="flex items-center justify-between">
                    <div>
                      <p className={`text-xs font-medium capitalize ${TX_TYPE_COLOR[tx.type] ?? "text-foreground"}`}>{tx.type}</p>
                      <p className="text-xs text-muted-foreground">{new Date(tx.createdAt).toLocaleDateString("en-IN")}</p>
                    </div>
                    <p className={`text-xs font-mono font-semibold ${TX_TYPE_COLOR[tx.type] ?? "text-foreground"}`}>
                      ₹{Number(tx.amount).toFixed(0)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
