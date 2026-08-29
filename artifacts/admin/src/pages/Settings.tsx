import { useState, useEffect } from "react";
import { useAdminGetSettings, useAdminUpdateSettings } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, Settings2, Copy, CheckCheck, QrCode, AlertCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAdminFetch } from "@/hooks/useAdminFetch";

// ── Helper: one UPI slot editor ──────────────────────────────────────────────
function UpiSlot({
  index,
  label,
  upiId,
  upiName,
  onChangeId,
  onChangeName,
}: {
  index: number;
  label: string;
  upiId: string;
  upiName: string;
  onChangeId: (v: string) => void;
  onChangeName: (v: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const copyText = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  const isActive = !!upiId.trim();
  return (
    <div className="rounded-lg border border-border bg-card/50 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/20 text-primary text-xs font-bold">{index}</span>
        <span className="text-sm font-medium text-foreground">{label}</span>
        {isActive && <span className="ml-auto text-xs font-normal text-green-500 bg-green-500/10 px-2 py-0.5 rounded-full">Active</span>}
      </div>
      <div className="space-y-1.5">
        <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
          UPI ID {index === 1 && <span className="text-destructive">*</span>}
        </label>
        <div className="flex gap-2">
          <Input
            value={upiId}
            onChange={(e) => onChangeId(e.target.value)}
            placeholder="9876543210@ybl  or  name@upi"
            className="font-mono"
          />
          {upiId && (
            <Button variant="outline" size="icon" onClick={() => copyText(upiId)} title="Copy">
              {copied ? <CheckCheck className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
            </Button>
          )}
        </div>
      </div>
      <div className="space-y-1.5">
        <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
          Account Name <span className="text-muted-foreground font-normal">(optional)</span>
        </label>
        <Input
          value={upiName}
          onChange={(e) => onChangeName(e.target.value)}
          placeholder="e.g. Jazment Cricket"
        />
        <p className="text-xs text-muted-foreground">Shown in the payment popup on user's phone.</p>
      </div>
    </div>
  );
}

export function Settings() {
  const { toast } = useToast();
  const adminFetch = useAdminFetch();
  const { data, isLoading } = useAdminGetSettings();
  const update = useAdminUpdateSettings();
  const whatsappStatus = useQuery({
    queryKey: ["whatsapp-otp-status"],
    queryFn: () => adminFetch<{ status: string; qrDataUrl: string | null }>("/api/admin/whatsapp-otp/status"),
    refetchInterval: 3000,
  });

  // UPI slot 1
  const [upiId1, setUpiId1] = useState("");
  const [upiName1, setUpiName1] = useState("");
  // UPI slot 2
  const [upiId2, setUpiId2] = useState("");
  const [upiName2, setUpiName2] = useState("");
  // UPI slot 3
  const [upiId3, setUpiId3] = useState("");
  const [upiName3, setUpiName3] = useState("");

  // Platform
  const [platformName, setPlatformName] = useState("");

  useEffect(() => {
    if (data) {
      setUpiId1(data.platformUpiId ?? "");
      setUpiName1(data.platformUpiName ?? "");
      setUpiId2(data.platformUpiId2 ?? "");
      setUpiName2(data.platformUpiName2 ?? "");
      setUpiId3(data.platformUpiId3 ?? "");
      setUpiName3(data.platformUpiName3 ?? "");
      setPlatformName(data.platformName ?? "");
    }
  }, [data]);

  const handleSave = () => {
    update.mutate(
      {
        data: {
          platformUpiId: upiId1.trim(),
          platformUpiName: upiName1.trim() || undefined,
          platformUpiId2: upiId2.trim() || undefined,
          platformUpiName2: upiName2.trim() || undefined,
          platformUpiId3: upiId3.trim() || undefined,
          platformUpiName3: upiName3.trim() || undefined,
          platformName: platformName.trim() || undefined,
          // Preserve existing bank details — managed via Bank Account page
          bankName: data?.bankName,
          bankHolderName: data?.bankHolderName,
          bankAccountNumber: data?.bankAccountNumber,
          bankIfsc: data?.bankIfsc,
        },
      },
      {
        onSuccess: () => toast({ title: "Settings saved ✓", description: "Changes are live in the app." }),
        onError: (err: any) => toast({ variant: "destructive", title: "Failed to save", description: err?.message }),
      }
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const anyUpiConfigured = !!(upiId1 || upiId2 || upiId3);

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Settings2 className="w-6 h-6 text-primary" /> Platform Settings
        </h1>
        <p className="text-muted-foreground mt-1">Configure payment details shown to users when they deposit.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-primary" />
            WhatsApp OTP Setup
            {whatsappStatus.data?.status === "ready" && (
              <span className="ml-auto text-xs font-normal text-green-500 bg-green-500/10 px-2 py-0.5 rounded-full">Connected</span>
            )}
          </CardTitle>
          <CardDescription>
            Link the WhatsApp account that will send four-digit login codes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {whatsappStatus.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading WhatsApp status…
            </div>
          ) : whatsappStatus.data?.status === "ready" ? (
            <p className="text-sm text-green-500">WhatsApp is linked and ready to send OTP messages.</p>
          ) : whatsappStatus.data?.qrDataUrl ? (
            <div className="space-y-3">
              <div className="rounded-lg bg-white p-3 w-fit">
                <img src={whatsappStatus.data.qrDataUrl} alt="WhatsApp linked-device QR code" className="w-72 h-72" />
              </div>
              <p className="text-sm text-muted-foreground">
                On the sender phone, open WhatsApp → Linked devices → Link a device, then scan this code.
              </p>
            </div>
          ) : (
            <div className="flex items-start gap-3 p-3 rounded-lg border border-warning/40 bg-warning/10">
              <AlertCircle className="w-5 h-5 text-warning mt-0.5" />
              <div>
                <p className="text-sm font-medium text-warning">WhatsApp is not connected</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Wait a few seconds for a new QR code. If none appears, restart the API Server workflow.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Warning if nothing configured */}
      {!anyUpiConfigured && (
        <div className="flex items-start gap-3 p-4 rounded-lg border border-destructive/40 bg-destructive/10">
          <AlertCircle className="w-5 h-5 text-destructive mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-destructive">No payment method configured</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              Users cannot deposit via UPI right now. Add at least one UPI ID below.
            </p>
          </div>
        </div>
      )}

      {/* ── UPI Settings ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-primary" />
            UPI Options
            {anyUpiConfigured && <span className="ml-auto text-xs font-normal text-green-500 bg-green-500/10 px-2 py-0.5 rounded-full">Active</span>}
          </CardTitle>
          <CardDescription>
            Up to 3 UPI IDs shown as separate options on the deposit screen. Users can copy or tap "Pay" on any one.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <UpiSlot index={1} label="UPI Option 1 (required)" upiId={upiId1} upiName={upiName1} onChangeId={setUpiId1} onChangeName={setUpiName1} />
          <UpiSlot index={2} label="UPI Option 2 (optional)" upiId={upiId2} upiName={upiName2} onChangeId={setUpiId2} onChangeName={setUpiName2} />
          <UpiSlot index={3} label="UPI Option 3 (optional)" upiId={upiId3} upiName={upiName3} onChangeId={setUpiId3} onChangeName={setUpiName3} />

          <div className="pt-2 space-y-1.5">
            <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
              Platform Name <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <Input
              value={platformName}
              onChange={(e) => setPlatformName(e.target.value)}
              placeholder="e.g. Jazment"
            />
            <p className="text-xs text-muted-foreground">Used in UPI deep-link transaction note.</p>
          </div>
        </CardContent>
      </Card>


      {/* Save button */}
      <Button
        onClick={handleSave}
        disabled={update.isPending || !upiId1.trim()}
        size="lg"
        className="w-full sm:w-auto"
      >
        {update.isPending ? (
          <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving…</>
        ) : (
          <><Save className="w-4 h-4 mr-2" /> Save Settings</>
        )}
      </Button>
      <p className="text-xs text-muted-foreground -mt-4">UPI Option 1 is required. All other fields are optional.</p>

      {/* Live preview */}
      {anyUpiConfigured && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-primary">What users will see</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {[
              { id: upiId1, name: upiName1, label: "UPI Option 1" },
              { id: upiId2, name: upiName2, label: "UPI Option 2" },
              { id: upiId3, name: upiName3, label: "UPI Option 3" },
            ].filter(u => u.id).map((u, i) => (
              <div key={i}>
                {i > 0 && <div className="border-t border-border/30 my-2" />}
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{u.label}</p>
                <div className="flex justify-between mt-1"><span className="text-muted-foreground">UPI ID:</span><span className="font-mono text-white">{u.id}</span></div>
                {u.name && <div className="flex justify-between"><span className="text-muted-foreground">Name:</span><span className="text-white">{u.name}</span></div>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
