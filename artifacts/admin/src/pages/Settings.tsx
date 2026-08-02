import { useState, useEffect } from "react";
import { useAdminGetSettings, useAdminUpdateSettings } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, Settings2, Copy, CheckCheck, QrCode, AlertCircle } from "lucide-react";

export function Settings() {
  const { toast } = useToast();
  const { data, isLoading } = useAdminGetSettings();
  const update = useAdminUpdateSettings();

  const [upiId, setUpiId] = useState("");
  const [upiName, setUpiName] = useState("");
  const [platformName, setPlatformName] = useState("");
  const [copied, setCopied] = useState(false);

  // Sync form with fetched data
  useEffect(() => {
    if (data) {
      setUpiId(data.platformUpiId ?? "");
      setUpiName(data.platformUpiName ?? "");
      setPlatformName(data.platformName ?? "");
    }
  }, [data]);

  const handleSave = () => {
    update.mutate(
      { data: { platformUpiId: upiId.trim(), platformUpiName: upiName.trim(), platformName: platformName.trim() } },
      {
        onSuccess: () => toast({ title: "Settings saved ✓", description: "UPI ID is now live in the app." }),
        onError: (err: any) => toast({ variant: "destructive", title: "Failed to save", description: err?.message }),
      }
    );
  };

  const copyUpi = () => {
    navigator.clipboard.writeText(upiId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const upiConfigured = !!data?.platformUpiId;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Settings2 className="w-6 h-6 text-primary" /> Platform Settings
        </h1>
        <p className="text-muted-foreground mt-1">Configure the UPI ID shown to users when they deposit money.</p>
      </div>

      {/* Status banner */}
      {!upiConfigured && (
        <div className="flex items-start gap-3 p-4 rounded-lg border border-destructive/40 bg-destructive/10">
          <AlertCircle className="w-5 h-5 text-destructive mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-destructive">UPI ID not configured</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              Users cannot deposit right now. Set your UPI ID below and save.
            </p>
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-primary" /> UPI Deposit Details
          </CardTitle>
          <CardDescription>
            This UPI ID appears on the deposit screen and is used for PhonePe / GPay / Paytm deep links.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* UPI ID */}
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
              UPI ID *
            </label>
            <div className="flex gap-2">
              <Input
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
                placeholder="yourname@upi  or  1234567890@ybl"
                className="font-mono"
              />
              {upiId && (
                <Button variant="outline" size="icon" onClick={copyUpi} title="Copy UPI ID">
                  {copied ? <CheckCheck className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              e.g. <span className="font-mono text-foreground">9876543210@ybl</span> or{" "}
              <span className="font-mono text-foreground">business@icici</span>
            </p>
          </div>

          {/* UPI display name */}
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
              Account Holder / UPI Name
            </label>
            <Input
              value={upiName}
              onChange={(e) => setUpiName(e.target.value)}
              placeholder="e.g. Jazment Cricket"
            />
            <p className="text-xs text-muted-foreground">
              Name shown in the UPI payment popup on the user's phone.
            </p>
          </div>

          {/* Platform name */}
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
              Platform Name
            </label>
            <Input
              value={platformName}
              onChange={(e) => setPlatformName(e.target.value)}
              placeholder="e.g. Jazment"
            />
          </div>

          <Button
            onClick={handleSave}
            disabled={update.isPending || !upiId.trim()}
            className="w-full sm:w-auto"
          >
            {update.isPending ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving…</>
            ) : (
              <><Save className="w-4 h-4 mr-2" /> Save Settings</>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Live preview */}
      {upiId && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-primary">Live Preview — what users see</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">UPI ID shown:</span>
              <span className="font-mono text-white">{upiId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Deep link target:</span>
              <span className="font-mono text-white truncate max-w-[55%]">
                upi://pay?pa={upiId}&pn={upiName || platformName}
              </span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
