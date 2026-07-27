import { useState, useRef } from "react";
import { useParams, Link } from "wouter";
import { 
  useGetMatch, 
  useGetMatchMarkets, 
  useUpdateMatch,
  useCreateMarket,
  useUpdateMarket,
  useSettleMarket,
  useRefundMarket,
  getGetMatchQueryKey,
  getGetMatchMarketsQueryKey
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Loader2, ArrowLeft, RefreshCw, Pause, Play, Ban, CheckCircle2, IndianRupee, Plus } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export function MatchDetail() {
  const { matchId } = useParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: match, isLoading: matchLoading } = useGetMatch(matchId as string, {
    query: { enabled: !!matchId, queryKey: getGetMatchQueryKey(matchId as string) }
  });
  
  const { data: marketsData, isLoading: marketsLoading } = useGetMatchMarkets(matchId as string, {}, {
    query: { enabled: !!matchId, queryKey: getGetMatchMarketsQueryKey(matchId as string, {}) }
  });

  const updateMatch = useUpdateMatch();
  
  const handleUpdateStatus = (newStatus: "upcoming" | "live" | "completed" | "cancelled") => {
    if (!matchId) return;
    updateMatch.mutate({ matchId, data: { status: newStatus } }, {
      onSuccess: () => {
        toast({ title: `Match marked as ${newStatus}` });
        queryClient.invalidateQueries({ queryKey: getGetMatchQueryKey(matchId) });
      },
      onError: (err: any) => {
        toast({ variant: "destructive", title: "Failed to update match", description: err.message });
      }
    });
  };

  if (matchLoading || marketsLoading) {
    return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  if (!match) return <div>Match not found</div>;

  const markets = marketsData?.markets || [];
  const openMarketsCount = markets.filter(m => m.status === 'open' || m.status === 'paused').length;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center gap-4">
        <Link href="/matches">
          <Button variant="ghost" size="icon"><ArrowLeft className="w-5 h-5" /></Button>
        </Link>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-white">
              {match.team1} vs {match.team2}
            </h1>
            <MatchStatusBadge status={match.status} />
          </div>
          <p className="text-muted-foreground mt-1 text-sm uppercase tracking-wider">
            {match.tournament} • {format(new Date(match.startTime), "MMM d, HH:mm")}
          </p>
        </div>
        
        <div className="ml-auto flex items-center gap-2">
          {match.status === 'upcoming' && (
            <Button onClick={() => handleUpdateStatus('live')} variant="outline" className="text-red-500 border-red-500 hover:bg-red-500/10">
              <Play className="w-4 h-4 mr-2" /> Start Match (मैच शुरू करें)
            </Button>
          )}
          {match.status === 'live' && (
            <Button onClick={() => handleUpdateStatus('completed')} variant="outline" className="text-green-500 border-green-500 hover:bg-green-500/10">
              <CheckCircle2 className="w-4 h-4 mr-2" /> Complete Match
            </Button>
          )}
          {(match.status === 'upcoming' || match.status === 'live') && (
            <Button onClick={() => handleUpdateStatus('cancelled')} variant="ghost" className="text-muted-foreground hover:text-destructive hover:bg-destructive/10">
              Cancel
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Match Info Column */}
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-muted-foreground uppercase tracking-wider">Match Status</CardTitle>
            </CardHeader>
            <CardContent>
              {match.liveScore?.score ? (
                <div className="bg-card-border p-4 rounded-md border border-border text-center">
                  <p className="text-2xl font-mono font-bold text-primary">{match.liveScore.score}</p>
                  <p className="text-xs mt-1 text-muted-foreground">Overs: {match.liveScore.overs || "-"} | {match.liveScore.battingTeam || "Batting"}</p>
                </div>
              ) : (
                <div className="bg-card-border p-4 rounded-md border border-border text-center text-muted-foreground text-sm">
                  No live score available
                </div>
              )}
              
              <div className="mt-6 space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-border">
                  <span className="text-sm text-muted-foreground">Open Markets</span>
                  <span className="font-bold">{openMarketsCount}</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-border">
                  <span className="text-sm text-muted-foreground">Total Predictions</span>
                  <span className="font-bold">{(match as any).totalPredictions || 0}</span>
                </div>
                <div className="flex justify-between items-center pb-2 border-b border-border">
                  <span className="text-sm text-muted-foreground">Match ID</span>
                  <span className="font-mono text-xs">{match.id.slice(0, 8)}...</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Markets Column */}
        <div className="lg:col-span-3 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold">Trading Markets (बाज़ार)</h2>
            <CreateMarketDialog matchId={match.id} />
          </div>

          {markets.length === 0 ? (
            <Card className="bg-card/50 border-dashed">
              <CardContent className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                <p>No markets created yet.</p>
                <CreateMarketDialog matchId={match.id} variant="link" />
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {markets.map(market => (
                <MarketCard key={market.id} market={market} matchId={match.id} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MarketCard({ market, matchId }: { market: any, matchId: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const updateMarket = useUpdateMarket();
  const settleMarket = useSettleMarket();
  const refundMarket = useRefundMarket();

  const handleStatusToggle = () => {
    const newStatus = market.status === 'open' ? 'paused' : 'open';
    updateMarket.mutate({ marketId: market.id, data: { status: newStatus } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetMatchMarketsQueryKey(matchId, {}) });
        toast({ title: `Market ${newStatus === 'open' ? 'Resumed' : 'Paused'}` });
      }
    });
  };

  const handleSettle = (answer: "YES" | "NO") => {
    if (!confirm(`Are you sure you want to settle this market as ${answer}? This action cannot be undone.`)) return;
    
    settleMarket.mutate({ marketId: market.id, data: { correctAnswer: answer } }, {
      onSuccess: (res) => {
        queryClient.invalidateQueries({ queryKey: getGetMatchMarketsQueryKey(matchId, {}) });
        toast({ 
          title: "Market Settled", 
          description: `Payout: ₹${res.totalPayout} to ${res.winnersCount} winners.` 
        });
      },
      onError: (err: any) => {
        toast({ variant: "destructive", title: "Failed to settle", description: err.message });
      }
    });
  };

  const handleRefund = () => {
    if (!confirm("Are you sure you want to refund this market? All users will get their money back.")) return;
    
    refundMarket.mutate({ marketId: market.id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetMatchMarketsQueryKey(matchId, {}) });
        toast({ title: "Market Refunded Successfully" });
      },
      onError: (err: any) => {
        toast({ variant: "destructive", title: "Failed to refund", description: err.message });
      }
    });
  };

  return (
    <Card className={`border-border ${market.status === 'settled' || market.status === 'refunded' ? 'opacity-70' : ''}`}>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <Badge variant="secondary" className="uppercase text-[10px] tracking-wider">{market.category}</Badge>
          <MarketStatusBadge status={market.status} />
        </div>
        <CardTitle className="text-lg mt-2 leading-tight">{market.question}</CardTitle>
        {market.questionHindi && <p className="text-sm text-muted-foreground">{market.questionHindi}</p>}
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4 mt-2 mb-4">
          <div className="bg-success/10 border border-success/20 rounded-md p-3 text-center">
            <p className="text-xs text-success uppercase tracking-widest font-bold mb-1">YES (हाँ)</p>
            <p className="text-xl font-mono font-bold">₹{market.yesPrice}</p>
            <p className="text-xs text-muted-foreground mt-1">{market.totalYes} shares</p>
          </div>
          <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3 text-center">
            <p className="text-xs text-destructive uppercase tracking-widest font-bold mb-1">NO (नहीं)</p>
            <p className="text-xl font-mono font-bold">₹{market.noPrice}</p>
            <p className="text-xs text-muted-foreground mt-1">{market.totalNo} shares</p>
          </div>
        </div>
        
        <div className="flex items-center justify-between text-sm text-muted-foreground border-t border-border pt-3">
          <span className="flex items-center"><IndianRupee className="w-4 h-4 mr-1"/> {market.totalAmount} Pool</span>
          
          {(market.status === 'open' || market.status === 'paused') && (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="h-8" onClick={handleStatusToggle}>
                {market.status === 'open' ? <Pause className="w-3.5 h-3.5 mr-1" /> : <Play className="w-3.5 h-3.5 mr-1" />}
                {market.status === 'open' ? 'Pause' : 'Resume'}
              </Button>
              
              <Dialog>
                <DialogTrigger asChild>
                  <Button size="sm" className="h-8 bg-blue-600 hover:bg-blue-700 text-white">Settle</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Settle Market (बाज़ार तय करें)</DialogTitle>
                    <p className="text-sm text-muted-foreground mt-2">{market.question}</p>
                  </DialogHeader>
                  <div className="grid grid-cols-2 gap-4 py-4">
                    <Button 
                      className="h-16 text-lg bg-success hover:bg-success/90" 
                      onClick={() => handleSettle("YES")}
                    >
                      YES won (हाँ)
                    </Button>
                    <Button 
                      className="h-16 text-lg bg-destructive hover:bg-destructive/90" 
                      onClick={() => handleSettle("NO")}
                    >
                      NO won (नहीं)
                    </Button>
                  </div>
                  <div className="border-t border-border pt-4">
                    <Button variant="ghost" className="w-full text-muted-foreground hover:text-white" onClick={handleRefund}>
                      <Ban className="w-4 h-4 mr-2" /> Cancel & Refund All Users
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          )}
          
          {market.status === 'settled' && (
            <span className="font-bold text-white flex items-center">
              Result: <Badge className={`ml-2 ${market.correctAnswer === 'YES' ? 'bg-success' : 'bg-destructive'}`}>{market.correctAnswer}</Badge>
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function CreateMarketDialog({ matchId, variant = "default" }: { matchId: string, variant?: "default" | "link" }) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createMarket = useCreateMarket();
  
  const [formData, setFormData] = useState({
    question: "",
    questionHindi: "",
    category: "match_winner" as any,
    yesPrice: "5.0",
    noPrice: "5.0"
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMarket.mutate({
      matchId,
      data: {
        ...formData,
        yesPrice: parseFloat(formData.yesPrice),
        noPrice: parseFloat(formData.noPrice)
      }
    }, {
      onSuccess: () => {
        toast({ title: "Market Created Successfully" });
        queryClient.invalidateQueries({ queryKey: getGetMatchMarketsQueryKey(matchId, {}) });
        setOpen(false);
        setFormData({ ...formData, question: "", questionHindi: "" }); // reset text but keep prices/category
      },
      onError: (err: any) => {
        toast({ variant: "destructive", title: "Failed to create market", description: err.message });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {variant === "default" ? (
          <Button size="sm"><Plus className="w-4 h-4 mr-2" /> New Market</Button>
        ) : (
          <Button variant="link" className="text-primary">Create the first market</Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create Trading Market</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wider text-muted-foreground">Category</label>
              <Select value={formData.category} onValueChange={(val) => setFormData({...formData, category: val})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="match_winner">Match Winner</SelectItem>
                  <SelectItem value="toss">Toss</SelectItem>
                  <SelectItem value="innings">Innings</SelectItem>
                  <SelectItem value="over">Over</SelectItem>
                  <SelectItem value="batsman">Batsman</SelectItem>
                  <SelectItem value="bowler">Bowler</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wider text-muted-foreground">Question (English)</label>
              <Input required value={formData.question} onChange={e => setFormData({...formData, question: e.target.value})} placeholder="e.g. Will CSK win the match?" />
            </div>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wider text-muted-foreground">Question (Hindi) - Optional</label>
              <Input value={formData.questionHindi} onChange={e => setFormData({...formData, questionHindi: e.target.value})} placeholder="e.g. क्या CSK मैच जीतेगी?" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wider text-muted-foreground">Initial Yes Price</label>
                <Input type="number" step="0.5" min="0.5" max="9.5" required value={formData.yesPrice} onChange={e => setFormData({...formData, yesPrice: e.target.value})} />
              </div>
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wider text-muted-foreground">Initial No Price</label>
                <Input type="number" step="0.5" min="0.5" max="9.5" required value={formData.noPrice} onChange={e => setFormData({...formData, noPrice: e.target.value})} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={createMarket.isPending}>
              {createMarket.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Deploy Market
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function MatchStatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'upcoming': return <Badge variant="outline" className="text-primary border-primary">UPCOMING</Badge>;
    case 'live': return <Badge variant="live">LIVE</Badge>;
    case 'completed': return <Badge variant="secondary">COMPLETED</Badge>;
    case 'cancelled': return <Badge variant="destructive">CANCELLED</Badge>;
    default: return <Badge variant="outline">{status}</Badge>;
  }
}

function MarketStatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'open': return <Badge variant="outline" className="text-success border-success">OPEN</Badge>;
    case 'paused': return <Badge variant="warning">PAUSED</Badge>;
    case 'closed': return <Badge variant="secondary">CLOSED</Badge>;
    case 'settled': return <Badge variant="outline" className="text-blue-400 border-blue-400">SETTLED</Badge>;
    case 'refunded': return <Badge variant="outline" className="text-muted-foreground border-muted-foreground">REFUNDED</Badge>;
    default: return <Badge variant="outline">{status}</Badge>;
  }
}
