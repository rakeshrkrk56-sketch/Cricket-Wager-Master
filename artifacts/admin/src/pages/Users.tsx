import { useState } from "react";
import { useListUsers } from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Search, Filter, ShieldCheck, AlertCircle, Clock, Download } from "lucide-react";
import { format } from "date-fns";
import { Link } from "wouter";
import { useDebounce } from "@/hooks/use-debounce";
import { exportToCsv } from "@/lib/export";

export function Users() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 500);
  const [status, setStatus] = useState<"all" | "active" | "suspended">("all");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useListUsers({
    page,
    limit: 20,
    search: debouncedSearch || undefined,
    status: status !== "all" ? status : undefined,
  });

  const users = data?.users ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 20));

  const handleExport = () => {
    if (!users.length) return;
    exportToCsv(`users-${format(new Date(), "yyyy-MM-dd")}.csv`,
      users.map((u) => ({
        id: u.id,
        phone: u.phone,
        name: u.name ?? "",
        wallet_balance: u.walletBalance,
        kyc_status: u.kycStatus,
        status: u.status,
        joined: format(new Date(u.createdAt), "yyyy-MM-dd"),
      }))
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Users</h1>
          <p className="text-muted-foreground mt-1 text-sm uppercase tracking-wider">Manage players & wallets</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleExport} disabled={!users.length}>
          <Download className="w-4 h-4 mr-2" /> Export CSV
        </Button>
      </div>

      <Card className="p-4 flex gap-4 bg-card/80">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by phone or name..."
            className="pl-9 bg-background"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <div className="w-48">
          <Select value={status} onValueChange={(v: any) => { setStatus(v); setPage(1); }}>
            <SelectTrigger className="bg-background">
              <Filter className="w-4 h-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Users</SelectItem>
              <SelectItem value="active">Active Only</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead>Phone / Name</TableHead>
              <TableHead>Wallet Balance</TableHead>
              <TableHead>KYC Status</TableHead>
              <TableHead>Account Status</TableHead>
              <TableHead>Joined</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
                </TableCell>
              </TableRow>
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center h-32 text-muted-foreground">
                  No users found.
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow
                  key={user.id}
                  className="border-border cursor-pointer group"
                  onClick={() => { window.location.href = `/users/${user.id}`; }}
                >
                  <TableCell>
                    <div className="font-mono text-sm font-bold text-white group-hover:text-primary transition-colors">{user.phone}</div>
                    <div className="text-xs text-muted-foreground">{user.name ?? "Unknown"}</div>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono font-bold">₹{user.walletBalance.toLocaleString()}</span>
                  </TableCell>
                  <TableCell><KycBadge status={user.kycStatus} /></TableCell>
                  <TableCell>
                    {user.status === "active"
                      ? <Badge variant="outline" className="text-success border-success/30">Active</Badge>
                      : <Badge variant="destructive">Suspended</Badge>}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {format(new Date(user.createdAt), "MMM d, yyyy")}
                    </span>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        {totalPages > 1 && (
          <div className="p-4 border-t border-border flex justify-between items-center text-sm text-muted-foreground">
            <span>Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, total)} of {total}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
              <span className="flex items-center px-2 font-mono">{page}/{totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

function KycBadge({ status }: { status: string }) {
  if (status === "verified")
    return <Badge variant="outline" className="text-blue-400 border-blue-400/30"><ShieldCheck className="w-3 h-3 mr-1" /> Verified</Badge>;
  if (status === "rejected")
    return <Badge variant="outline" className="text-destructive border-destructive/30"><AlertCircle className="w-3 h-3 mr-1" /> Rejected</Badge>;
  return <Badge variant="outline" className="text-warning border-warning/30">Pending</Badge>;
}
