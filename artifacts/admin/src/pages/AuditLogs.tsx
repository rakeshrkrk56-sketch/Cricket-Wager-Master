import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Shield, ChevronLeft, ChevronRight, Search, Filter } from "lucide-react";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { useAdminFetch } from "@/hooks/useAdminFetch";

function actionColor(action: string): string {
  if (action.includes("suspend")) return "text-red-400 bg-red-400/10 border-red-400/30";
  if (action.includes("hold")) return "text-yellow-400 bg-yellow-400/10 border-yellow-400/30";
  if (action.includes("restored") || action.includes("active")) return "text-green-400 bg-green-400/10 border-green-400/30";
  if (action.includes("delete")) return "text-red-500 bg-red-500/10 border-red-500/30";
  if (action.includes("kyc")) return "text-blue-400 bg-blue-400/10 border-blue-400/30";
  if (action.includes("wallet")) return "text-primary bg-primary/10 border-primary/30";
  return "text-muted-foreground bg-muted/30 border-border";
}

function formatAction(action: string): string {
  return action
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function AuditLogs() {
  const adminFetch = useAdminFetch();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const limit = 50;

  const { data, isLoading } = useQuery({
    queryKey: ["audit-logs", page, actionFilter],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (actionFilter) params.set("action", actionFilter);
      return adminFetch(`/api/admin/audit-logs?${params}`);
    },
  });

  const totalPages = data ? Math.ceil(data.total / limit) : 1;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white font-mono">Audit Logs</h1>
          <p className="text-muted-foreground mt-1 text-sm">Every admin action, timestamped and immutable.</p>
        </div>
        <Shield className="w-8 h-8 text-primary opacity-40" />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4 flex gap-3">
          <div className="relative flex-1">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Filter by action (e.g. suspend, hold, kyc…)"
              value={actionFilter}
              onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="w-4 h-4 text-primary" />
            Action Log
            {data && <span className="ml-auto text-sm font-normal text-muted-foreground">{data.total} total</span>}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : !data?.logs?.length ? (
            <p className="text-center text-muted-foreground py-12">No audit logs found</p>
          ) : (
            <div className="space-y-0">
              <div className="grid grid-cols-[auto_1fr_auto_auto] gap-4 px-3 pb-2 text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                <span>When</span><span>Action</span><span>Admin</span><span>Target</span>
              </div>
              {data.logs.map((log: any) => (
                <div key={log.id} className="grid grid-cols-[auto_1fr_auto_auto] gap-4 px-3 py-3 border-b border-border/50 hover:bg-muted/20 transition-colors items-start">
                  <div className="text-xs text-muted-foreground whitespace-nowrap pt-0.5">
                    <p>{format(new Date(log.createdAt), "MMM d, yyyy")}</p>
                    <p>{format(new Date(log.createdAt), "HH:mm:ss")}</p>
                  </div>
                  <div>
                    <Badge variant="outline" className={`text-xs mb-1 ${actionColor(log.action)}`}>
                      {formatAction(log.action)}
                    </Badge>
                    {log.reason && (
                      <p className="text-xs text-muted-foreground italic">Reason: {log.reason}</p>
                    )}
                    {(log.prevStatus || log.newStatus) && (
                      <p className="text-xs text-muted-foreground">
                        {log.prevStatus && <span className="text-yellow-400">{log.prevStatus}</span>}
                        {log.prevStatus && log.newStatus && <span className="mx-1">→</span>}
                        {log.newStatus && <span className="text-green-400">{log.newStatus}</span>}
                      </p>
                    )}
                  </div>
                  <div className="text-xs text-right text-muted-foreground whitespace-nowrap">
                    {log.admin?.name ?? log.admin?.phone ?? "—"}
                  </div>
                  <div className="text-xs text-right text-muted-foreground whitespace-nowrap">
                    {log.targetUserId ? (
                      <span className="font-mono text-[10px]">{log.targetUserId.slice(0, 8)}…</span>
                    ) : "—"}
                  </div>
                </div>
              ))}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4">
                  <p className="text-xs text-muted-foreground">Page {page} of {totalPages}</p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="icon" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="icon" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
