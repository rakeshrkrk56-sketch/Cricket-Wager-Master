import { useState, useEffect } from "react";
import { useAdminGetSettings, useAdminUpdateSettings } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, Building2, Copy, CheckCheck, AlertCircle } from "lucide-react";

export function BankAccount() {
  const { toast } = useToast();
  const { data, isLoading } = useAdminGetSettings();
  const update = useAdminUpdateSettings();

  const [bankName, setBankName] = useState("");
  const [bankHolder, setBankHolder] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [bankIfsc, setBankIfsc] = useState("");
  const [copiedAccount, setCopiedAccount] = useState(false);

  useEffect(() => {
    if (data) {
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
          // Pass UPI fields as-is so we don't wipe them
          platformUpiId: data?.platformUpiId ?? "",
          bankName: bankName.trim() || "",
          bankHolderName: bankHolder.trim() || "",
          bankAccountNumber: bankAccount.trim() || "",
          bankIfsc: bankIfsc.trim().toUpperCase() || "",
        },
      },
      {
        onSuccess: () =>
          toast({ title: "Bank details saved ✓", description: "Changes are live in the app." }),
        onError: (err: any) =>
          toast({ variant: "destructive", title: "Failed to save", description: err?.message }),
      }
    );
  };

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedAccount(true);
    setTimeout(() => setCopiedAccount(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isConfigured = !!(data?.bankName && data?.bankAccountNumber && data?.bankIfsc);

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Building2 className="w-6 h-6 text-primary" /> Bank Account Management
        </h1>
        <p className="text-muted-foreground mt-1">
          Configure the bank account shown to users who deposit via NEFT / IMPS.
          Leave all fields blank to hide the Bank Transfer option entirely.
        </p>
      </div>

      {/* Status banner */}
      {isConfigured ? (
        <div className="flex items-center gap-3 p-4 rounded-lg border border-green-500/30 bg-green-500/10">
          <Building2 className="w-5 h-5 text-green-500 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-green-400">Bank Transfer is active</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              Users will see the Bank tab on the deposit screen.
            </p>
          </div>
          <span className="ml-auto text-xs font-normal text-green-500 bg-green-500/10 px-2 py-0.5 rounded-full">
            Active
          </span>
        </div>
      ) : (
        <div className="flex items-start gap-3 p-4 rounded-lg border border-yellow-500/30 bg-yellow-500/10">
          <AlertCircle className="w-5 h-5 text-yellow-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-yellow-400">Bank Transfer is hidden</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              Fill in Bank Name, Account Number and IFSC to activate this option.
            </p>
          </div>
        </div>
      )}

      {/* Form card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            Bank Account Details
          </CardTitle>
          <CardDescription>
            All four fields below are needed to activate the Bank Transfer tab in the app.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Row 1 */}
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

          {/* Account number */}
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
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copyText(bankAccount)}
                  title="Copy"
                >
                  {copiedAccount ? (
                    <CheckCheck className="w-4 h-4 text-green-500" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
              )}
            </div>
          </div>

          {/* IFSC */}
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

      {/* Save */}
      <Button onClick={handleSave} disabled={update.isPending} size="lg" className="w-full sm:w-auto">
        {update.isPending ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving…
          </>
        ) : (
          <>
            <Save className="w-4 h-4 mr-2" /> Save Bank Details
          </>
        )}
      </Button>
      <p className="text-xs text-muted-foreground -mt-4">
        Leave all fields blank and save to remove the Bank Transfer option from the deposit screen.
      </p>

      {/* Live preview */}
      {(bankAccount || bankName) && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-primary">What users will see</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
              Bank Transfer
            </p>
            {bankName && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Bank:</span>
                <span className="text-white">{bankName}</span>
              </div>
            )}
            {bankHolder && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Holder:</span>
                <span className="text-white">{bankHolder}</span>
              </div>
            )}
            {bankAccount && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Account:</span>
                <span className="font-mono text-white">{bankAccount}</span>
              </div>
            )}
            {bankIfsc && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">IFSC:</span>
                <span className="font-mono text-white">{bankIfsc}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
