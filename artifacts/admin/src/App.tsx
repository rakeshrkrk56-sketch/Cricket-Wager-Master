import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toast';
import { Route, Switch, Router as WouterRouter, Redirect } from 'wouter';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { AdminLayout } from '@/components/AdminLayout';

import { Dashboard } from '@/pages/Dashboard';
import { Matches } from '@/pages/Matches';
import { MatchDetail } from '@/pages/MatchDetail';
import { Users } from '@/pages/Users';
import { UserDetail } from '@/pages/UserDetail';
import { Login } from '@/pages/Login';

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
        {isAuthenticated ? <Redirect to="/" /> : <Login />}
      </Route>
      
      <Route path="/">
        <ProtectedRoute component={Dashboard} />
      </Route>
      <Route path="/matches">
        <ProtectedRoute component={Matches} />
      </Route>
      <Route path="/matches/:matchId">
        <ProtectedRoute component={MatchDetail} />
      </Route>
      <Route path="/users">
        <ProtectedRoute component={Users} />
      </Route>
      <Route path="/users/:userId">
        <ProtectedRoute component={UserDetail} />
      </Route>
      
      <Route>
        {isAuthenticated ? (
          <AdminLayout>
            <div className="flex flex-col items-center justify-center h-[60vh] text-center">
              <h1 className="text-4xl font-bold text-white mb-2">404</h1>
              <p className="text-muted-foreground uppercase tracking-wider mb-6">Sector not found</p>
              <Redirect to="/" />
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
          <Router />
          <Toaster />
        </AuthProvider>
      </WouterRouter>
    </QueryClientProvider>
  );
}

export default App;
