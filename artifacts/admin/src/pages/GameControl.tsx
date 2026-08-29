import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, AlertTriangle, Gamepad2, Loader2, Pause, Play, RefreshCw, ShieldCheck } from "lucide-react";
import { useAdminFetch } from "@/hooks/useAdminFetch";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type GameMode = "AUTOMATIC" | "MANAGED";
type Choice = "DRAGON" | "TIGER" | "TIE";

interface GameControlResponse {
  mode?: GameMode;
  paused?: boolean;
  serverTime?: string;
  round?: {
    id: string;
    status: string;
    bettingClosesAt: string;
    revealEndsAt: string | null;
    dragonRank: number | null;
    tigerRank: number | null;
    result: Choice | null;
  } | null;
  pools?: Partial<Record<Choice, number>>;
  liabilities?: Partial<Record<Choice, number>>;
}

const CHOICES: Choice[] = ["DRAGON", "TIGER", "TIE"];
const money = (value: unknown) =>
  `₹${Number(value ?? 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

function valueFor(
  values: Partial<Record<Choice, number>> | undefined,
  choice: Choice,
) {
  if (!values) return 0;
  return Number(values[choice] ?? 0);
}

export function GameControl() {
  const adminFetch = useAdminFetch();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const query = useQuery({
    queryKey: ["admin-game-control"],
    queryFn: () => adminFetch<GameControlResponse>("/api/admin/game-control"),
    refetchInterval: 2_000,
  });

  const control = query.data;
  const round = control?.round;
  const mode: GameMode = control?.mode === "MANAGED" ? "MANAGED" : "AUTOMATIC";
  const paused = Boolean(control?.paused);
  const state = round?.status ?? (paused ? "PAUSED" : "WAITING");
  const deadline = state === "BETTING" ? round?.bettingClosesAt : round?.revealEndsAt;
  const seconds = deadline
    ? Math.max(0, Math.ceil((Date.parse(deadline) - Date.parse(control?.serverTime ?? new Date().toISOString())) / 1000))
    : 0;

  const update = async (changes: { mode?: GameMode; paused?: boolean; closeBetting?: boolean }) => {
    setSaving(true);
    try {
      await adminFetch("/api/admin/game-control", {
        method: "PUT",
        body: JSON.stringify(changes),
      });
      await query.refetch();
      toast({ title: "Game control updated", description: "The live table configuration is now current." });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Unable to update game control",
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            <Gamepad2 className="w-7 h-7 text-primary" />
            Game Control
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Monitor the live Dragon Tiger table and its current risk exposure.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div
            className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${
              query.isError
                ? "border-destructive/30 bg-destructive/10 text-destructive"
                : "border-green-500/30 bg-green-500/10 text-green-400"
            }`}
            data-testid="status-game-control-connection"
          >
            <span className={`w-2 h-2 rounded-full ${query.isError ? "bg-destructive" : "bg-green-500 animate-pulse"}`} />
            {query.isError ? "OFFLINE" : "LIVE · 2s"}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => query.refetch()}
            disabled={query.isFetching}
            data-testid="button-refresh-game-control"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${query.isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {query.isLoading ? (
        <div className="h-64 flex items-center justify-center" data-testid="status-game-control-loading">
          <Loader2 className="w-7 h-7 animate-spin text-primary" />
        </div>
      ) : query.isError ? (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="p-6 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-destructive mt-0.5" />
            <div>
              <p className="font-semibold text-destructive" data-testid="status-game-control-error">Game control unavailable</p>
              <p className="text-sm text-muted-foreground mt-1">
                {query.error instanceof Error ? query.error.message : "Could not load the live table."}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Operating mode</CardTitle>
                <CardDescription>Choose how operations staff observe the table.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="max-w-sm">
                  <Select
                    value={mode}
                    onValueChange={(value: GameMode) => update({ mode: value })}
                    disabled={saving}
                  >
                    <SelectTrigger data-testid="select-game-mode">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AUTOMATIC" data-testid="option-mode-automatic">Automatic</SelectItem>
                      <SelectItem value="MANAGED" data-testid="option-mode-managed">Managed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="rounded-lg border border-primary/25 bg-primary/5 p-4 flex items-start gap-3">
                  <ShieldCheck className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">Fair outcomes are never overridden</p>
                    <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                      Managed mode is for risk monitoring only. It does not select cards, change odds,
                      choose winners, or otherwise alter independently fair game outcomes.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className={paused ? "border-yellow-500/40" : "border-green-500/30"}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {paused ? <Pause className="w-5 h-5 text-yellow-400" /> : <Play className="w-5 h-5 text-green-400" />}
                  Table status
                </CardTitle>
                <CardDescription>Pause or resume new rounds.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between rounded-lg bg-muted/30 p-4">
                  <div>
                    <p className="font-semibold" data-testid="status-game-paused">{paused ? "Paused" : "Running"}</p>
                    <p className="text-xs text-muted-foreground mt-1">{paused ? "No new betting rounds" : "Rounds proceeding normally"}</p>
                  </div>
                  <Switch
                    checked={!paused}
                    onCheckedChange={(running) => update({ paused: !running })}
                    disabled={saving}
                    aria-label="Table running"
                    data-testid="switch-game-running"
                  />
                </div>
                <Button
                  variant="destructive"
                  className="w-full mt-4"
                  onClick={() => update({ closeBetting: true })}
                  disabled={saving || state !== "BETTING"}
                  data-testid="button-close-betting"
                >
                  <Pause className="w-4 h-4 mr-2" />
                  Close Betting Now
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Metric label="Round state" value={state} icon={Activity} testId="text-round-state" />
            <Metric label="Time remaining" value={`${Math.max(0, seconds)}s`} icon={RefreshCw} testId="text-round-timer" />
            <Metric label="Mode" value={mode} icon={Gamepad2} testId="text-game-mode" />
            <Metric label="Round" value={round?.id ?? "—"} icon={ShieldCheck} testId="text-round-id" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ExposureCard title="Betting pools" values={control?.pools} prefix="pool" />
            <ExposureCard title="Potential liabilities" values={control?.liabilities} prefix="liability" />
          </div>
        </>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  icon: Icon,
  testId,
}: {
  label: string;
  value: string;
  icon: typeof Activity;
  testId: string;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
          <Icon className="w-4 h-4 text-primary" />
        </div>
        <p className="text-xl font-bold font-mono mt-3 truncate" data-testid={testId}>{value}</p>
      </CardContent>
    </Card>
  );
}

function ExposureCard({
  title,
  values,
  prefix,
}: {
  title: string;
  values: Partial<Record<Choice, number>> | undefined;
  prefix: string;
}) {
  const total = CHOICES.reduce((sum, choice) => sum + valueFor(values, choice), 0);
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription data-testid={`text-${prefix}-total`}>Total {money(total)}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {CHOICES.map((choice) => (
          <div key={choice} className="flex items-center justify-between border-b border-border/60 pb-3 last:border-0 last:pb-0">
            <span className="text-sm text-muted-foreground">{choice}</span>
            <span className="font-mono font-semibold" data-testid={`text-${prefix}-${choice.toLowerCase()}`}>
              {money(valueFor(values, choice))}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}