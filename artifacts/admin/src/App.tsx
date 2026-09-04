import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toast';
import { Route, Switch, Router as WouterRouter, Redirect } from 'wouter';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { AdminLayout } from '@/components/AdminLayout';

import { Dashboard } from '@/pages/Dashboard';
import { Users } from '@/pages/Users';
import { UserDetail } from '@/pages/UserDetail';
import { Deposits } from '@/pages/Deposits';
import { Withdrawals } from '@/pages/Withdrawals';
import { Support } from '@/pages/Support';
import { SupportDetail } from '@/pages/SupportDetail';
import { BankAccount } from '@/pages/BankAccount';
import { AuditLogs } from '@/pages/AuditLogs';
import { GameControl } from '@/pages/GameControl';
import { Settings } from '@/pages/Settings';
import { Login } from '@/pages/Login';
import { PendingRequestAlertsProvider } from '@/components/PendingRequestAlerts';
import { LandingPage } from '@/pages/LandingPage';
import { DepositLandingPage } from '@/pages/DepositLandingPage';
import { AppDistribution } from '@/pages/AppDistribution';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function ProtectedRoute({ component: Component }: { component: any }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Redirect to="/login" />;
  
  return (
    <AdminLayout>
      <Component />
    </AdminLayout>
  );
}

function Router() {
  const { isAuthenticated } = useAuth();

  return (
    <Switch>
      <Route path="/login">
        {isAuthenticated ? <Redirect to="/admin" /> : <Login />}
      </Route>
      
      <Route path="/">
        <LandingPage />
      </Route>
      <Route path="/deposit">
        <DepositLandingPage />
      </Route>
      <Route path="/admin">
        <ProtectedRoute component={Dashboard} />
      </Route>
      <Route path="/users">
        <ProtectedRoute component={Users} />
      </Route>
      <Route path="/users/:userId">
        <ProtectedRoute component={UserDetail} />
      </Route>
      <Route path="/deposits">
        <ProtectedRoute component={Deposits} />
      </Route>
      <Route path="/withdrawals">
        <ProtectedRoute component={Withdrawals} />
      </Route>
      <Route path="/support">
        <ProtectedRoute component={Support} />
      </Route>
      <Route path="/support/:ticketId">
        <ProtectedRoute component={SupportDetail} />
      </Route>
      <Route path="/bank-account">
        <ProtectedRoute component={BankAccount} />
      </Route>
      <Route path="/audit-logs">
        <ProtectedRoute component={AuditLogs} />
      </Route>
      <Route path="/game-control">
        <ProtectedRoute component={GameControl} />
      </Route>
      <Route path="/settings">
        <ProtectedRoute component={Settings} />
      </Route>
      <Route path="/app-distribution">
        <ProtectedRoute component={AppDistribution} />
      </Route>
      
      <Route>
        {isAuthenticated ? (
          <AdminLayout>
            <div className="flex flex-col items-center justify-center h-[60vh] text-center">
              <h1 className="text-4xl font-bold text-white mb-2">404</h1>
              <p className="text-muted-foreground uppercase tracking-wider mb-6">Sector not found</p>
              <Redirect to="/admin" />
            </div>
          </AdminLayout>
        ) : (
          <Redirect to="/login" />
        )}
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
        <AuthProvider>
          <PendingRequestAlertsProvider>
            <Router />
            <Toaster />
          </PendingRequestAlertsProvider>
        </AuthProvider>
      </WouterRouter>
    </QueryClientProvider>
  );
}

export default App;
