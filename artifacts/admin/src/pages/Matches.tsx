import { useState, useMemo } from "react";
import { useAdminListMatches, useCreateMatch, useGetLiveCricketMatches } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Plus, Calendar as CalendarIcon, Clock, ExternalLink, Download, Search } from "lucide-react";
import { format } from "date-fns";
import { Link } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { exportToCsv } from "@/lib/export";
import { useDebounce } from "@/hooks/use-debounce";

type StatusFilter = "all" | "upcoming" | "live" | "completed" | "cancelled";
const PAGE_SIZE = 20;

export function Matches() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 400);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);

  const apiStatus = statusFilter === "all" ? undefined : statusFilter;
  const { data, isLoading, refetch } = useAdminListMatches({
    status: apiStatus,
    search: debouncedSearch || undefined,
    page,
    limit: PAGE_SIZE,
  } as any);

  const matches = data?.matches ?? [];
  const total: number = (data as any)?.total ?? matches.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const handleExport = () => {
    if (!matches.length) return;
    exportToCsv(`matches-${format(new Date(), "yyyy-MM-dd")}.csv`,
      matches.map((m) => ({
        id: m.id,
        tournament: m.tournament,
        team1: m.team1,
        team2: m.team2,
        start_time: format(new Date(m.startTime), "yyyy-MM-dd HH:mm"),
        status: m.status,
      }))
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Match Management</h1>
          <p className="text-muted-foreground mt-1 text-sm uppercase tracking-wider">All matches & markets (मैच प्रबंधन)</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport} disabled={!matches.length}>
            <Download className="w-4 h-4 mr-2" /> Export CSV
          </Button>
          <CreateMatchDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} onSuccess={refetch} />
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4 flex flex-wrap gap-3 bg-card/80">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by team or tournament..."
            className="pl-9 bg-background"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <Select value={statusFilter} onValueChange={(v: StatusFilter) => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-44 bg-background"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="upcoming">Upcoming</SelectItem>
            <SelectItem value="live">Live</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="w-16 text-center">ID</TableHead>
              <TableHead>Tournament</TableHead>
              <TableHead>Match</TableHead>
              <TableHead>Start Time</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-primary" />
                </TableCell>
              </TableRow>
            ) : matches.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center h-32 text-muted-foreground">
                  No matches found.
                </TableCell>
              </TableRow>
            ) : (
              matches.map((match) => (
                <TableRow key={match.id} className="border-border">
                  <TableCell className="font-mono text-xs text-muted-foreground text-center">{match.id.slice(0, 4)}</TableCell>
                  <TableCell className="font-medium text-muted-foreground text-xs uppercase tracking-wider">{match.tournament}</TableCell>
                  <TableCell>
                    <div className="font-bold text-base flex items-center gap-2">
                      {match.team1} <span className="text-muted-foreground text-xs font-normal">vs</span> {match.team2}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center text-sm">
                      <CalendarIcon className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
                      {format(new Date(match.startTime), "MMM d, yyyy")}
                      <Clock className="w-3.5 h-3.5 ml-3 mr-1 text-muted-foreground" />
                      {format(new Date(match.startTime), "HH:mm")}
                    </div>
                  </TableCell>
                  <TableCell><StatusBadge status={match.status} /></TableCell>
                  <TableCell className="text-right">
                    <Link href={`/matches/${match.id}`}>
                      <Button variant="secondary" size="sm">
                        Manage <ExternalLink className="w-3.5 h-3.5 ml-2" />
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {totalPages > 1 && (
          <div className="p-4 border-t border-border flex justify-between items-center text-sm text-muted-foreground">
            <span>Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}</span>
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

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "upcoming": return <Badge variant="outline" className="text-primary border-primary">UPCOMING</Badge>;
    case "live": return <Badge variant="live">LIVE</Badge>;
    case "completed": return <Badge variant="secondary">COMPLETED</Badge>;
    case "cancelled": return <Badge variant="destructive">CANCELLED</Badge>;
    default: return <Badge variant="outline">{status}</Badge>;
  }
}

function CreateMatchDialog({ open, onOpenChange, onSuccess }: { open: boolean; onOpenChange: (o: boolean) => void; onSuccess: () => void }) {
  const { toast } = useToast();
  const createMatch = useCreateMatch();
  const [pickerSearch, setPickerSearch] = useState("");
  const [selectedCricId, setSelectedCricId] = useState<string | null>(null);
  const { data: cricData, isLoading: cricLoading, isError: cricError } = useGetLiveCricketMatches({
    query: { enabled: open, staleTime: 60_000 } as any,
  });
  const [formData, setFormData] = useState({
    team1: "", team2: "", tournament: "",
    date: format(new Date(), "yyyy-MM-dd"), time: "19:30", cricApiMatchId: "",
  });

  const cricMatches = useMemo(() => {
    const list = cricData?.matches ?? [];
    const q = pickerSearch.trim().toLowerCase();
    return q ? list.filter((m) => m.name.toLowerCase().includes(q)) : list;
  }, [cricData, pickerSearch]);

  const handlePick = (m: NonNullable<typeof cricData>["matches"][number]) => {
    setSelectedCricId(m.id);
    const [team1, team2] = (m.teams?.length ?? 0) >= 2
      ? [m.teams![0], m.teams![1]]
      : m.name.split(",")[0].split(" vs ");
    // "Ireland vs Afghanistan, 4th ODI, Afghanistan tour of Ireland, 2026" → tournament from remainder
    const tournament = m.name.split(",").slice(1).join(",").trim() || m.matchType?.toUpperCase() || "Cricket";
    const start = m.dateTimeGMT ? new Date(m.dateTimeGMT + (m.dateTimeGMT.endsWith("Z") ? "" : "Z")) : new Date();
    setFormData({
      team1: team1?.trim() ?? "",
      team2: team2?.trim() ?? "",
      tournament,
      date: format(start, "yyyy-MM-dd"),
      time: format(start, "HH:mm"),
      cricApiMatchId: m.id,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMatch.mutate(
      { data: { team1: formData.team1, team2: formData.team2, tournament: formData.tournament, startTime: new Date(`${formData.date}T${formData.time}`).toISOString(), cricApiMatchId: formData.cricApiMatchId || undefined } },
      {
        onSuccess: () => { toast({ title: "Match created" }); onSuccess(); onOpenChange(false); },
        onError: (err: any) => toast({ variant: "destructive", title: "Failed", description: err.message }),
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button><Plus className="w-4 h-4 mr-2" /> Create Match</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[560px] max-h-[85vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader><DialogTitle>Create New Match</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            {/* Real match picker from cricket data provider */}
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wider text-muted-foreground">Pick a Real Match (Live & Upcoming)</label>
              <Input
                placeholder="Search real matches..."
                value={pickerSearch}
                onChange={(e) => setPickerSearch(e.target.value)}
              />
              <div className="border border-border rounded-md max-h-48 overflow-y-auto divide-y divide-border">
                {cricLoading ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin mx-auto mb-1" /> Loading real matches...
                  </div>
                ) : cricError ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    Live cricket data is temporarily unavailable. You can still enter the match manually below.
                  </div>
                ) : cricMatches.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">No matches found.</div>
                ) : (
                  cricMatches.map((m) => {
                    const isLive = m.matchStarted === true && m.matchEnded !== true;
                    return (
                      <button
                        type="button"
                        key={m.id}
                        onClick={() => handlePick(m)}
                        className={`w-full text-left p-2.5 text-sm hover:bg-accent transition-colors ${selectedCricId === m.id ? "bg-accent" : ""}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium truncate">{m.name}</span>
                          {isLive ? (
                            <Badge variant="live" className="shrink-0">LIVE</Badge>
                          ) : m.matchEnded !== true ? (
                            <Badge variant="outline" className="shrink-0 text-primary border-primary">UPCOMING</Badge>
                          ) : null}
                        </div>
                        <div className="text-xs text-muted-foreground truncate mt-0.5">{m.status}</div>
                      </button>
                    );
                  })
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">Selecting a match auto-fills the form and links live scores. Or fill in manually below.</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wider text-muted-foreground">Team 1</label>
                <Input required value={formData.team1} onChange={e => setFormData(f => ({ ...f, team1: e.target.value }))} placeholder="e.g. CSK" />
              </div>
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wider text-muted-foreground">Team 2</label>
                <Input required value={formData.team2} onChange={e => setFormData(f => ({ ...f, team2: e.target.value }))} placeholder="e.g. RCB" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wider text-muted-foreground">Tournament</label>
              <Input required value={formData.tournament} onChange={e => setFormData(f => ({ ...f, tournament: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wider text-muted-foreground">Date</label>
                <Input type="date" required value={formData.date} onChange={e => setFormData(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wider text-muted-foreground">Time</label>
                <Input type="time" required value={formData.time} onChange={e => setFormData(f => ({ ...f, time: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2 pt-2 border-t border-border">
              <label className="text-xs uppercase tracking-wider text-muted-foreground">CricAPI Match ID (Optional)</label>
              <Input value={formData.cricApiMatchId} onChange={e => setFormData(f => ({ ...f, cricApiMatchId: e.target.value }))} placeholder="For live scores" />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={createMatch.isPending}>
              {createMatch.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create Match
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
