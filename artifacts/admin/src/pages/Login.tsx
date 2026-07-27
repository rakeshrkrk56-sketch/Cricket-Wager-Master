import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useSendOtp, useVerifyOtp } from "@workspace/api-client-react";
import { Activity, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function Login() {
  const { login } = useAuth();
  const { toast } = useToast();
  
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"phone" | "otp">("phone");

  const sendOtp = useSendOtp();
  const verifyOtp = useVerifyOtp();

  const handleSendOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || phone.length < 10) return;
    
    // Auto format assuming India, since platform is for Indian cricket fans
    const formattedPhone = phone.startsWith("+") ? phone : `+91${phone}`;
    
    sendOtp.mutate({ data: { phone: formattedPhone } }, {
      onSuccess: () => {
        setStep("otp");
        toast({ title: "OTP Sent", description: "Please check your phone." });
      },
      onError: (err: any) => {
        toast({ 
          variant: "destructive", 
          title: "Failed to send OTP", 
          description: err.message || "Unknown error occurred" 
        });
      }
    });
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp) return;
    
    const formattedPhone = phone.startsWith("+") ? phone : `+91${phone}`;
    
    verifyOtp.mutate({ data: { phone: formattedPhone, otp } }, {
      onSuccess: (res) => {
        if (res.user.role !== "admin") {
          toast({ variant: "destructive", title: "Access Denied", description: "You don't have admin privileges." });
          return;
        }
        login(res.token);
        toast({ title: "Login Successful", description: "Welcome back." });
      },
      onError: (err: any) => {
        toast({ 
          variant: "destructive", 
          title: "Invalid OTP", 
          description: err.message || "Please try again." 
        });
      }
    });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="mb-8 flex flex-col items-center">
        <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mb-4 ring-1 ring-primary/50">
          <Activity className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-3xl font-bold font-mono tracking-tight uppercase text-white">Jazment Ops</h1>
        <p className="text-muted-foreground mt-2 uppercase text-sm tracking-widest">Command Center</p>
      </div>

      <Card className="w-full max-w-md border-border/50 shadow-2xl shadow-primary/5">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl">Admin Login</CardTitle>
          <CardDescription>Secure access for operations team only.</CardDescription>
        </CardHeader>
        <CardContent>
          {step === "phone" ? (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Phone Number</label>
                <Input 
                  placeholder="9876543210" 
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="font-mono text-lg h-12"
                />
              </div>
              <Button type="submit" className="w-full h-12 text-lg" disabled={sendOtp.isPending || phone.length < 10}>
                {sendOtp.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Send OTP"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground uppercase tracking-wider">One-Time Password</label>
                <Input 
                  placeholder="000000" 
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  className="font-mono text-center text-2xl tracking-widest h-12"
                  maxLength={6}
                  autoFocus
                />
              </div>
              <div className="flex gap-3">
                <Button type="button" variant="outline" onClick={() => setStep("phone")} className="h-12 w-1/3">
                  Back
                </Button>
                <Button type="submit" className="flex-1 h-12 text-lg" disabled={verifyOtp.isPending || otp.length < 4}>
                  {verifyOtp.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : "Verify Access"}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
