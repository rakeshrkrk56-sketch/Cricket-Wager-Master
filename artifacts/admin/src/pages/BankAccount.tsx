import { useState, useEffect } from "react";
import { useAdminGetSettings, useAdminUpdateSettings } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, Save, Building2, QrCode, Copy, CheckCheck, AlertCircle,
} from "lucide-react";

// ── UPI slot editor ───────────────────────────────────────────────────────────
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
  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  const isActive = !!upiId.trim();
  return (
    <div className="rounded-lg border border-border bg-card/50 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/20 text-primary text-xs font-bold">
          {index}
        </span>
        <span className="text-sm font-medium text-foreground">{label}</span>
        {isActive && (
          <span className="ml-auto text-xs font-normal text-green-500 bg-green-500/10 px-2 py-0.5 rounded-full">
            Active
          </span>
        )}
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
            <Button variant="outline" size="icon" onClick={() => copy(upiId)} title="Copy">
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
        <p className="text-xs text-muted-foreground">Shown in the payment popup on the user's phone.</p>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function BankAccount() {
  const { toast } = useToast();
  const { data, isLoading } = useAdminGetSettings();
  const update = useAdminUpdateSettings();

  // UPI slots
  const [upiId1, setUpiId1] = useState("");
  const [upiName1, setUpiName1] = useState("");
  const [upiId2, setUpiId2] = useState("");
  const [upiName2, setUpiName2] = useState("");
  const [upiId3, setUpiId3] = useState("");
  const [upiName3, setUpiName3] = useState("");
  const [platformName, setPlatformName] = useState("");

  // Bank details
  const [bankName, setBankName] = useState("");
  const [bankHolder, setBankHolder] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [bankIfsc, setBankIfsc] = useState("");
  const [copiedAccount, setCopiedAccount] = useState(false);

  useEffect(() => {
    if (data) {
      setUpiId1(data.platformUpiId ?? "");
      setUpiName1(data.platformUpiName ?? "");
      setUpiId2(data.platformUpiId2 ?? "");
      setUpiName2(data.platformUpiName2 ?? "");
      setUpiId3(data.platformUpiId3 ?? "");
      setUpiName3(data.platformUpiName3 ?? "");
      setPlatformName(data.platformName ?? "");
      setBankName(data.bankName ?? "");
      setBankHolder(data.bankHolderName ?? "");
      setBankAccount(data.bankAccountNumber ?? "");
      setBankIfsc(data.bankIfsc ?? "");
    }
  }, [data]);

  const copyAccount = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedAccount(true);
    setTimeout(() => setCopiedAccount(false), 2000);
  };

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
          bankName: bankName.trim() || undefined,
          bankHolderName: bankHolder.trim() || undefined,
          bankAccountNumber: bankAccount.trim() || undefined,
          bankIfsc: bankIfsc.trim().toUpperCase() || undefined,
        },
      },
      {
        onSuccess: () =>
          toast({ title: "Bank Management saved ✓", description: "Changes are live in the app." }),
        onError: (err: any) =>
          toast({ variant: "destructive", title: "Failed to save", description: err?.message }),
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
  const bankConfigured = !!(bankName && bankAccount && bankIfsc);

  return (
    <div className="space-y-8 max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* ── Page header ── */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Building2 className="w-6 h-6 text-primary" /> Bank Management
        </h1>
        <p className="text-muted-foreground mt-1">
          Configure all payment-receiving details shown to users when they deposit funds.
        </p>
      </div>

      {/* ── Status row ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* UPI status */}
        {anyUpiConfigured ? (
          <div className="flex items-center gap-3 p-4 rounded-lg border border-green-500/30 bg-green-500/10">
            <QrCode className="w-5 h-5 text-green-500 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-green-400">UPI is active</p>
              <p className="text-xs text-muted-foreground mt-0.5">Users can pay via UPI.</p>
            </div>
            <span className="ml-auto text-xs text-green-500 bg-green-500/10 px-2 py-0.5 rounded-full">Active</span>
          </div>
        ) : (
          <div className="flex items-start gap-3 p-4 rounded-lg border border-destructive/40 bg-destructive/10">
            <AlertCircle className="w-5 h-5 text-destructive mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-destructive">No UPI configured</p>
              <p className="text-xs text-muted-foreground mt-0.5">Users cannot deposit via UPI.</p>
            </div>
          </div>
        )}

        {/* Bank status */}
        {bankConfigured ? (
          <div className="flex items-center gap-3 p-4 rounded-lg border border-green-500/30 bg-green-500/10">
            <Building2 className="w-5 h-5 text-green-500 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-green-400">Bank Transfer is active</p>
              <p className="text-xs text-muted-foreground mt-0.5">Users can deposit via NEFT/IMPS.</p>
            </div>
            <span className="ml-auto text-xs text-green-500 bg-green-500/10 px-2 py-0.5 rounded-full">Active</span>
          </div>
        ) : (
          <div className="flex items-start gap-3 p-4 rounded-lg border border-yellow-500/30 bg-yellow-500/10">
            <AlertCircle className="w-5 h-5 text-yellow-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-yellow-400">Bank Transfer is hidden</p>
              <p className="text-xs text-muted-foreground mt-0.5">Fill bank details below to activate.</p>
            </div>
          </div>
        )}
      </div>

      {/* ── UPI Options ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-primary" />
            UPI Options
            {anyUpiConfigured && (
              <span className="ml-auto text-xs font-normal text-green-500 bg-green-500/10 px-2 py-0.5 rounded-full">
                Active
              </span>
            )}
          </CardTitle>
          <CardDescription>
            Up to 3 UPI IDs shown on the deposit screen. Users can copy or tap "Pay" on any one.
            UPI Option 1 is required to enable UPI deposits.
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

      {/* ── Bank Account Details ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            Bank Account Details
            {bankConfigured && (
              <span className="ml-auto text-xs font-normal text-green-500 bg-green-500/10 px-2 py-0.5 rounded-full">
                Active
              </span>
            )}
          </CardTitle>
          <CardDescription>
            Shown to users who deposit via NEFT / IMPS. Leave all four fields blank to hide the
            Bank Transfer tab entirely.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                Bank Name
              </label>
              <Input
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="e.g. State Bank of India"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                Account Holder Name
              </label>
              <Input
                value={bankHolder}
                onChange={(e) => setBankHolder(e.target.value)}
                placeholder="e.g. Jazment Pvt Ltd"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
              Account Number
            </label>
            <div className="flex gap-2">
              <Input
                value={bankAccount}
                onChange={(e) => setBankAccount(e.target.value)}
                placeholder="e.g. 1234567890123"
                className="font-mono"
              />
              {bankAccount && (
                <Button variant="outline" size="icon" onClick={() => copyAccount(bankAccount)} title="Copy">
                  {copiedAccount ? <CheckCheck className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                </Button>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
              IFSC Code
            </label>
            <Input
              value={bankIfsc}
              onChange={(e) => setBankIfsc(e.target.value.toUpperCase())}
              placeholder="e.g. SBIN0001234"
              className="font-mono"
              maxLength={11}
            />
            <p className="text-xs text-muted-foreground">
              11-character code found on your cheque book or passbook.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ── Live preview ── */}
      {(anyUpiConfigured || bankConfigured) && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-primary">What users will see</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {anyUpiConfigured && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">UPI Options</p>
                {[
                  { id: upiId1, name: upiName1, label: "UPI Option 1" },
                  { id: upiId2, name: upiName2, label: "UPI Option 2" },
                  { id: upiId3, name: upiName3, label: "UPI Option 3" },
                ].filter(u => u.id).map((u, i) => (
                  <div key={i} className={i > 0 ? "pt-2 border-t border-border/30" : ""}>
                    <p className="text-xs text-muted-foreground">{u.label}</p>
                    <div className="flex justify-between mt-0.5">
                      <span className="text-muted-foreground">UPI ID:</span>
                      <span className="font-mono text-white">{u.id}</span>
                    </div>
                    {u.name && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Name:</span>
                        <span className="text-white">{u.name}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {bankConfigured && (
              <div className={`space-y-1 ${anyUpiConfigured ? "pt-4 border-t border-border/30" : ""}`}>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Bank Transfer</p>
                {bankName && <div className="flex justify-between"><span className="text-muted-foreground">Bank:</span><span className="text-white">{bankName}</span></div>}
                {bankHolder && <div className="flex justify-between"><span className="text-muted-foreground">Holder:</span><span className="text-white">{bankHolder}</span></div>}
                {bankAccount && <div className="flex justify-between"><span className="text-muted-foreground">Account:</span><span className="font-mono text-white">{bankAccount}</span></div>}
                {bankIfsc && <div className="flex justify-between"><span className="text-muted-foreground">IFSC:</span><span className="font-mono text-white">{bankIfsc}</span></div>}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Save ── */}
      <div className="space-y-2">
        <Button onClick={handleSave} disabled={update.isPending} size="lg" className="w-full sm:w-auto">
          {update.isPending ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving…</>
          ) : (
            <><Save className="w-4 h-4 mr-2" /> Save All Changes</>
          )}
        </Button>
        <p className="text-xs text-muted-foreground">
          UPI Option 1 is required to enable UPI deposits. Leave bank fields blank to hide Bank Transfer.
        </p>
      </div>
    </div>
  );
}
