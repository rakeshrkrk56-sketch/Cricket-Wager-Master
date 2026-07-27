import { useState } from "react";
import { useAdminListMatches, useCreateMatch } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Plus, Calendar as CalendarIcon, Clock, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { Link } from "wouter";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

export function Matches() {
  const { data, isLoading, refetch } = useAdminListMatches({});
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  
  if (isLoading) {
    return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  const matches = data?.matches || [];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Match Management</h1>
          <p className="text-muted-foreground mt-1 text-sm uppercase tracking-wider">All matches & markets (मैच प्रबंधन)</p>
        </div>
        <CreateMatchDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} onSuccess={refetch} />
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="w-16 text-center">ID</TableHead>
              <TableHead>Tournament</TableHead>
              <TableHead>Match</TableHead>
              <TableHead>Start Time (समय)</TableHead>
              <TableHead>Status (स्थिति)</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {matches.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center h-32 text-muted-foreground">
                  No matches found. Create one to get started.
                </TableCell>
              </TableRow>
            ) : (
              matches.map((match) => (
                <TableRow key={match.id} className="border-border">
                  <TableCell className="font-mono text-xs text-muted-foreground text-center">
                    {match.id.slice(0, 4)}
                  </TableCell>
                  <TableCell className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
                    {match.tournament}
                  </TableCell>
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
                  <TableCell>
                    <StatusBadge status={match.status} />
                  </TableCell>
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
      </Card>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'upcoming': return <Badge variant="outline" className="text-primary border-primary">UPCOMING (आगामी)</Badge>;
    case 'live': return <Badge variant="live">LIVE (लाइव)</Badge>;
    case 'completed': return <Badge variant="secondary">COMPLETED (पूरा हुआ)</Badge>;
    case 'cancelled': return <Badge variant="destructive">CANCELLED (रद्द)</Badge>;
    default: return <Badge variant="outline">{status}</Badge>;
  }
}

function CreateMatchDialog({ open, onOpenChange, onSuccess }: { open: boolean, onOpenChange: (open: boolean) => void, onSuccess: () => void }) {
  const { toast } = useToast();
  const createMatch = useCreateMatch();
  
  const [formData, setFormData] = useState({
    team1: "",
    team2: "",
    tournament: "IPL 2024",
    date: format(new Date(), "yyyy-MM-dd"),
    time: "19:30",
    cricApiMatchId: ""
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Combine date and time into ISO string
    const startTime = new Date(`${formData.date}T${formData.time}`).toISOString();
    
    createMatch.mutate({
      data: {
        team1: formData.team1,
        team2: formData.team2,
        tournament: formData.tournament,
        startTime,
        cricApiMatchId: formData.cricApiMatchId || undefined
      }
    }, {
      onSuccess: () => {
        toast({ title: "Match created successfully" });
        onSuccess();
        onOpenChange(false);
      },
      onError: (err: any) => {
        toast({ variant: "destructive", title: "Failed to create match", description: err.message });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button><Plus className="w-4 h-4 mr-2" /> Create Match (नया मैच)</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create New Match</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wider text-muted-foreground">Team 1</label>
                <Input required value={formData.team1} onChange={e => setFormData({...formData, team1: e.target.value})} placeholder="e.g. CSK" />
              </div>
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wider text-muted-foreground">Team 2</label>
                <Input required value={formData.team2} onChange={e => setFormData({...formData, team2: e.target.value})} placeholder="e.g. RCB" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wider text-muted-foreground">Tournament</label>
              <Input required value={formData.tournament} onChange={e => setFormData({...formData, tournament: e.target.value})} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wider text-muted-foreground">Date</label>
                <Input type="date" required value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wider text-muted-foreground">Time (Local)</label>
                <Input type="time" required value={formData.time} onChange={e => setFormData({...formData, time: e.target.value})} />
              </div>
            </div>
            <div className="space-y-2 pt-2 border-t border-border">
              <label className="text-xs uppercase tracking-wider text-muted-foreground">CricAPI Match ID (Optional)</label>
              <Input value={formData.cricApiMatchId} onChange={e => setFormData({...formData, cricApiMatchId: e.target.value})} placeholder="For live scores" />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={createMatch.isPending}>
              {createMatch.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Create Match
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
