import { useState, useEffect } from "react";
import { useAdminGetSettings, useAdminUpdateSettings } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, Settings2, Copy, CheckCheck, QrCode, Building2, AlertCircle } from "lucide-react";

export function Settings() {
  const { toast } = useToast();
  const { data, isLoading } = useAdminGetSettings();
  const update = useAdminUpdateSettings();

  // UPI fields
  const [upiId, setUpiId] = useState("");
  const [upiName, setUpiName] = useState("");
  const [platformName, setPlatformName] = useState("");
  const [copiedUpi, setCopiedUpi] = useState(false);

  // Bank fields
  const [bankName, setBankName] = useState("");
  const [bankHolder, setBankHolder] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [bankIfsc, setBankIfsc] = useState("");
  const [copiedAccount, setCopiedAccount] = useState(false);

  useEffect(() => {
    if (data) {
      setUpiId(data.platformUpiId ?? "");
      setUpiName(data.platformUpiName ?? "");
      setPlatformName(data.platformName ?? "");
      setBankName(data.bankName ?? "");
      setBankHolder(data.bankHolderName ?? "");
      setBankAccount(data.bankAccountNumber ?? "");
      setBankIfsc(data.bankIfsc ?? "");
    }
  }, [data]);

  const handleSave = () => {
    update.mutate(
      {
        data: {
          platformUpiId: upiId.trim(),
          platformUpiName: upiName.trim() || undefined,
          platformName: platformName.trim() || undefined,
          bankName: bankName.trim() || undefined,
          bankHolderName: bankHolder.trim() || undefined,
          bankAccountNumber: bankAccount.trim() || undefined,
          bankIfsc: bankIfsc.trim().toUpperCase() || undefined,
        },
      },
      {
        onSuccess: () => toast({ title: "Settings saved ✓", description: "Changes are live in the app." }),
        onError: (err: any) => toast({ variant: "destructive", title: "Failed to save", description: err?.message }),
      }
    );
  };

  const copyText = (text: string, setter: (v: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setter(true);
    setTimeout(() => setter(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const upiConfigured = !!data?.platformUpiId;
  const bankConfigured = !!(data?.bankName && data?.bankAccountNumber && data?.bankIfsc);

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Settings2 className="w-6 h-6 text-primary" /> Platform Settings
        </h1>
        <p className="text-muted-foreground mt-1">Configure payment details shown to users when they deposit.</p>
      </div>

      {/* Warning if nothing configured */}
      {!upiConfigured && !bankConfigured && (
        <div className="flex items-start gap-3 p-4 rounded-lg border border-destructive/40 bg-destructive/10">
          <AlertCircle className="w-5 h-5 text-destructive mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-destructive">No payment method configured</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              Users cannot deposit right now. Add a UPI ID and/or bank account below.
            </p>
          </div>
        </div>
      )}

      {/* ── UPI Settings ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-primary" />
            UPI Details
            {upiConfigured && <span className="ml-auto text-xs font-normal text-green-500 bg-green-500/10 px-2 py-0.5 rounded-full">Active</span>}
          </CardTitle>
          <CardDescription>
            Shown on the UPI deposit screen. Required for PhonePe / GPay / Paytm deep links.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
              UPI ID <span className="text-destructive">*</span>
            </label>
            <div className="flex gap-2">
              <Input
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
                placeholder="9876543210@ybl  or  name@upi"
                className="font-mono"
              />
              {upiId && (
                <Button variant="outline" size="icon" onClick={() => copyText(upiId, setCopiedUpi)} title="Copy">
                  {copiedUpi ? <CheckCheck className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
              UPI Account Name <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <Input
              value={upiName}
              onChange={(e) => setUpiName(e.target.value)}
              placeholder="e.g. Jazment Cricket"
            />
            <p className="text-xs text-muted-foreground">Shown in the payment popup on user's phone.</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
              Platform Name <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <Input
              value={platformName}
              onChange={(e) => setPlatformName(e.target.value)}
              placeholder="e.g. Jazment"
            />
          </div>
        </CardContent>
      </Card>

      {/* ── Bank Account Settings ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            Bank Account Details
            {bankConfigured && <span className="ml-auto text-xs font-normal text-green-500 bg-green-500/10 px-2 py-0.5 rounded-full">Active</span>}
          </CardTitle>
          <CardDescription>
            Shown when users choose Bank Transfer (NEFT / IMPS) on the deposit screen. Leave blank to hide this option.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Bank Name</label>
              <Input
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="e.g. State Bank of India"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Account Holder Name</label>
              <Input
                value={bankHolder}
                onChange={(e) => setBankHolder(e.target.value)}
                placeholder="e.g. Jazment Pvt Ltd"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Account Number</label>
            <div className="flex gap-2">
              <Input
                value={bankAccount}
                onChange={(e) => setBankAccount(e.target.value)}
                placeholder="e.g. 1234567890123"
                className="font-mono"
              />
              {bankAccount && (
                <Button variant="outline" size="icon" onClick={() => copyText(bankAccount, setCopiedAccount)} title="Copy">
                  {copiedAccount ? <CheckCheck className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">IFSC Code</label>
            <Input
              value={bankIfsc}
              onChange={(e) => setBankIfsc(e.target.value.toUpperCase())}
              placeholder="e.g. SBIN0001234"
              className="font-mono"
              maxLength={11}
            />
            <p className="text-xs text-muted-foreground">11-character code found on your cheque book or passbook.</p>
          </div>
        </CardContent>
      </Card>

      {/* Save button */}
      <Button
        onClick={handleSave}
        disabled={update.isPending || !upiId.trim()}
        size="lg"
        className="w-full sm:w-auto"
      >
        {update.isPending ? (
          <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving…</>
        ) : (
          <><Save className="w-4 h-4 mr-2" /> Save Settings</>
        )}
      </Button>
      <p className="text-xs text-muted-foreground -mt-4">UPI ID is required. All other fields are optional.</p>

      {/* Live preview */}
      {(upiId || bankAccount) && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-primary">What users will see</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {upiId && (
              <>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">UPI</p>
                <div className="flex justify-between"><span className="text-muted-foreground">UPI ID:</span><span className="font-mono text-white">{upiId}</span></div>
                {upiName && <div className="flex justify-between"><span className="text-muted-foreground">Name:</span><span className="text-white">{upiName}</span></div>}
              </>
            )}
            {bankAccount && (
              <>
                <div className="border-t border-border/50 pt-2 mt-2" />
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Bank Transfer</p>
                {bankName && <div className="flex justify-between"><span className="text-muted-foreground">Bank:</span><span className="text-white">{bankName}</span></div>}
                {bankHolder && <div className="flex justify-between"><span className="text-muted-foreground">Holder:</span><span className="text-white">{bankHolder}</span></div>}
                <div className="flex justify-between"><span className="text-muted-foreground">Account:</span><span className="font-mono text-white">{bankAccount}</span></div>
                {bankIfsc && <div className="flex justify-between"><span className="text-muted-foreground">IFSC:</span><span className="font-mono text-white">{bankIfsc}</span></div>}
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
