import { useState } from "react";
import { useAdminListSupportTickets, getAdminListSupportTicketsQueryKey } from "@workspace/api-client-react";
import { Link } from "wouter";
import { MessageSquare, Search, Filter, Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { exportToCsv } from "@/lib/export";

const PAGE_SIZE = 30;

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  open: { label: "Open", color: "bg-amber-500/10 text-amber-400 border-amber-500/20", icon: AlertCircle },
  in_progress: { label: "In Progress", color: "bg-blue-500/10 text-blue-400 border-blue-500/20", icon: Clock },
  resolved: { label: "Resolved", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", icon: CheckCircle },
  closed: { label: "Closed", color: "bg-muted text-muted-foreground border-border", icon: XCircle },
};

const CATEGORY_LABELS: Record<string, string> = {
  deposit_issue: "Deposit Issue",
  withdrawal_issue: "Withdrawal Issue",
  prediction_issue: "Prediction Issue",
  kyc_issue: "KYC Issue",
  account_issue: "Account Issue",
  technical_problem: "Technical Problem",
  other: "Other",
};

export function Support() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [category, setCategory] = useState("all");
  const [page, setPage] = useState(1);

  const apiStatus = status === "all" ? undefined : status;
  const apiCategory = category === "all" ? undefined : category;

  const qKey = getAdminListSupportTicketsQueryKey({ status: apiStatus as any, category: apiCategory, search: search || undefined, page, limit: PAGE_SIZE });
  const { data, isLoading } = useAdminListSupportTickets(
    { status: apiStatus as any, category: apiCategory, search: search || undefined, page, limit: PAGE_SIZE },
    { query: { queryKey: qKey, refetchInterval: 30000 } }
  );

  const tickets = data?.tickets ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const handleExport = () => {
    if (!tickets.length) return;
    exportToCsv(`support-tickets-${new Date().toISOString().slice(0, 10)}`, tickets.map((t) => ({
      ID: t.id.slice(0, 8),
      Subject: t.subject,
      Category: CATEGORY_LABELS[t.category] ?? t.category,
      Status: t.status,
      User: (t as any).user?.phone ?? "",
      Created: t.createdAt,
      Updated: t.updatedAt,
    })));
  };

  // Counts by status
  const openCount = tickets.filter((t) => t.status === "open").length;
  const inProgressCount = tickets.filter((t) => t.status === "in_progress").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-primary" />
            Support Tickets
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {total} total · {openCount} open · {inProgressCount} in progress
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleExport} disabled={!tickets.length}>
          Export CSV
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by phone…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={category} onValueChange={(v) => { setCategory(v); setPage(1); }}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {Object.entries(CATEGORY_LABELS).map(([v, l]) => (
              <SelectItem key={v} value={v}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="border border-border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="text-muted-foreground">Ticket ID</TableHead>
              <TableHead className="text-muted-foreground">Subject</TableHead>
              <TableHead className="text-muted-foreground">Category</TableHead>
              <TableHead className="text-muted-foreground">User</TableHead>
              <TableHead className="text-muted-foreground">Status</TableHead>
              <TableHead className="text-muted-foreground">Last Updated</TableHead>
              <TableHead className="text-muted-foreground text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-16">
                  Loading tickets…
                </TableCell>
              </TableRow>
            ) : tickets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-16">
                  No tickets found
                </TableCell>
              </TableRow>
            ) : tickets.map((ticket) => {
              const cfg = STATUS_CONFIG[ticket.status] ?? STATUS_CONFIG.open;
              const StatusIcon = cfg.icon;
              const user = (ticket as any).user;
              return (
                <TableRow key={ticket.id} className="hover:bg-muted/30 transition-colors">
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    #{ticket.id.slice(0, 8)}
                  </TableCell>
                  <TableCell className="max-w-[240px]">
                    <p className="font-medium text-foreground truncate">{ticket.subject}</p>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-muted-foreground">
                      {CATEGORY_LABELS[ticket.category] ?? ticket.category}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-foreground">{user?.phone ?? "—"}</span>
                    {user?.name && <p className="text-xs text-muted-foreground">{user.name}</p>}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-xs ${cfg.color} flex items-center gap-1 w-fit`}>
                      <StatusIcon className="w-3 h-3" />
                      {cfg.label}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(ticket.updatedAt).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link href={`/support/${ticket.id}`}>
                      <Button variant="ghost" size="sm" className="text-primary hover:text-primary">
                        View
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}
