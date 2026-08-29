import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function Login() {
  const { login } = useAuth();
  const { toast } = useToast();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/auth/admin-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error || "Unable to sign in");
      }
      if (payload.user?.role !== "admin" || typeof payload.token !== "string") {
        throw new Error("Admin access is not available for this account");
      }

      login(payload.token);
      toast({ title: "Login Successful", description: "Welcome back." });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Login Failed",
        description: error instanceof Error ? error.message : "Please check your credentials and try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
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
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Username</label>
              <Input
                placeholder="Admin username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="font-mono text-lg h-12"
                autoComplete="username"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Password</label>
              <Input
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="font-mono text-lg h-12"
                autoComplete="current-password"
              />
            </div>
            <Button type="submit" className="w-full h-12 text-lg" disabled={isSubmitting || !username.trim() || !password}>
              {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Sign In"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
