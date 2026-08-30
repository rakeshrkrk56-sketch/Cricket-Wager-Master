import { useEffect, useState } from 'react';
import {
  useAdminListDeposits,
  getAdminListDepositsQueryKey,
  useApproveDeposit,
  useRejectDeposit,
} from '@workspace/api-client-react';
import { useAdminFetch } from '@/hooks/useAdminFetch';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, CheckCircle, XCircle, Image, RefreshCw, Download, Search } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { exportToCsv } from '@/lib/export';
import { useDebounce } from '@/hooks/use-debounce';
import { useAuth } from '@/contexts/AuthContext';
import { formatUserIdentifier } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type StatusFilter = 'pending' | 'approved' | 'rejected' | 'all';

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-warning/10 text-warning border-warning/30',
  approved: 'bg-success/10 text-success border-success/30',
  rejected: 'bg-destructive/10 text-destructive border-destructive/30',
};
const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending', approved: 'Approved', rejected: 'Rejected',
};

const PAGE_SIZE = 20;
type DepositAction = 'approve' | 'reject';

export function Deposits() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { token, logout } = useAuth();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 400);
  const [page, setPage] = useState(1);
  const [remarksMap, setRemarksMap] = useState<Record<string, string>>({});
  const [screenshotOpen, setScreenshotOpen] = useState<string | null>(null);
  const [screenshotLoading, setScreenshotLoading] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<{ id: string; action: DepositAction } | null>(null);
  const [confirmationCountdown, setConfirmationCountdown] = useState(0);
  const adminFetch = useAdminFetch();

  const apiStatus = statusFilter === 'all' ? undefined : statusFilter;
  const qKey = getAdminListDepositsQueryKey({ status: apiStatus, limit: PAGE_SIZE, page, search: debouncedSearch || undefined });

  const { data, isLoading, isError, error, refetch } = useAdminListDeposits(
    { status: apiStatus, limit: PAGE_SIZE, page, search: debouncedSearch || undefined } as any,
    {
      query: {
        queryKey: qKey,
        enabled: !!token,
        refetchInterval: statusFilter === 'pending' ? 5000 : 30000,
        refetchOnWindowFocus: true,
      },
    }
  );
  const approve = useApproveDeposit();
  const reject = useRejectDeposit();

  const deposits = (data as any)?.deposits ?? [];
  const total: number = (data as any)?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pending = statusFilter === 'pending' ? deposits.length : 0;

  useEffect(() => {
    const status = (error as any)?.status;
    if (status === 401 || status === 403) logout();
  }, [error, logout]);

  useEffect(() => {
    if (!pendingAction) {
      setConfirmationCountdown(0);
      return;
    }

    setConfirmationCountdown(5);
    const interval = window.setInterval(() => {
      setConfirmationCountdown((current) => {
        if (current <= 1) {
          window.clearInterval(interval);
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [pendingAction]);

  const requestAction = (id: string, action: DepositAction) => {
    if (action === 'reject' && !remarksMap[id]?.trim()) {
      toast({ variant: 'destructive', title: 'Remarks required', description: 'Add a reason before rejecting this deposit.' });
      return;
    }
    setPendingAction({ id, action });
  };

  const handleApprove = (id: string) => {
    approve.mutate(
      { depositId: id, data: { remarks: remarksMap[id] } },
      {
        onSuccess: () => {
          toast({ title: 'Deposit approved', description: 'Wallet credited.' });
          queryClient.invalidateQueries({ queryKey: getAdminListDepositsQueryKey() });
          refetch();
        },
        onError: (err: any) => toast({ variant: 'destructive', title: 'Error', description: err?.data?.error ?? 'Failed' }),
      }
    );
  };

  const handleReject = (id: string) => {
    if (!remarksMap[id]?.trim()) {
      toast({ variant: 'destructive', title: 'Remarks required' });
      return;
    }
    reject.mutate(
      { depositId: id, data: { remarks: remarksMap[id] } },
      {
        onSuccess: () => {
          toast({ title: 'Deposit rejected' });
          queryClient.invalidateQueries({ queryKey: getAdminListDepositsQueryKey() });
          refetch();
        },
        onError: (err: any) => toast({ variant: 'destructive', title: 'Error', description: err?.data?.error ?? 'Failed' }),
      }
    );
  };

  const handleConfirmedAction = () => {
    if (!pendingAction || confirmationCountdown > 0) return;

    const { id, action } = pendingAction;
    setPendingAction(null);
    if (action === 'approve') {
      handleApprove(id);
    } else {
      handleReject(id);
    }
  };

  const handleViewScreenshot = async (depositId: string) => {
    setScreenshotLoading(depositId);
    try {
      const data = await adminFetch<{ screenshotBase64: string }>(
        `/api/admin/deposits/${depositId}/screenshot`
      );
      setScreenshotOpen(data.screenshotBase64);
    } catch {
      toast({ variant: 'destructive', title: 'Failed to load screenshot' });
    } finally {
      setScreenshotLoading(null);
    }
  };

  const handleExport = () => {
    if (!deposits.length) return;
    exportToCsv(`deposits-${statusFilter}-${format(new Date(), 'yyyy-MM-dd')}.csv`,
      deposits.map((d: any) => ({
        id: d.id,
        user: formatUserIdentifier(d.user?.phone ?? d.userId),
        name: d.user?.name ?? '',
        amount: d.amount,
        method: d.method,
        utr: d.utrNumber ?? '',
        status: d.status,
        remarks: d.remarks ?? '',
        created: format(new Date(d.createdAt), 'yyyy-MM-dd HH:mm'),
      }))
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Deposits</h1>
          <p className="text-muted-foreground mt-1 text-sm uppercase tracking-wider">
             Deposit Requests
            {statusFilter === 'pending' && pending > 0 && (
              <span className="ml-2 text-warning font-semibold">{pending} pending</span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport} disabled={!deposits.length}>
            <Download className="w-4 h-4 mr-2" /> Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4 flex flex-wrap gap-3 bg-card/80">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by phone or UTR..."
            className="pl-9 bg-background"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <Select value={statusFilter} onValueChange={(v: StatusFilter) => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-40 bg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </Card>

      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : isError ? (
        <div className="border border-destructive/50 bg-destructive/10 rounded-xl flex flex-col gap-3 items-center justify-center h-40 text-center px-6">
          <p className="font-semibold text-destructive">Could not load deposit requests</p>
          <p className="text-sm text-muted-foreground">
            {(error as any)?.status === 401 || (error as any)?.status === 403
              ? 'Your admin session has expired. Please sign in again.'
              : 'The server could not be reached. Retry to load pending deposits.'}
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 mr-2" /> Retry
          </Button>
        </div>
      ) : deposits.length === 0 ? (
        <div className="border border-dashed rounded-xl flex items-center justify-center h-32 text-muted-foreground">
          No deposits found.
        </div>
      ) : (
        <div className="space-y-4">
          {deposits.map((dep: any) => (
            <Card key={dep.id} className="bg-card border-border">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-white font-mono text-xl font-bold">
                        ₹{Number(dep.amount).toLocaleString('en-IN')}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${STATUS_BADGE[dep.status]}`}>
                        {STATUS_LABEL[dep.status]}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                        {dep.method === 'manual' ? 'Manual' : 'UPI App'}
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground space-y-0.5">
                      <p>
                        <span className="text-foreground font-medium">{formatUserIdentifier(dep.user?.phone ?? dep.userId)}</span>
                        {dep.user?.name && <span className="ml-2">({dep.user.name})</span>}
                      </p>
                      {dep.utrNumber && <p>UTR: <span className="font-mono text-foreground">{dep.utrNumber}</span></p>}
                      <p>{format(new Date(dep.createdAt), 'dd MMM yyyy, HH:mm')}</p>
                    </div>
                  </div>
                  {dep.hasScreenshot && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={screenshotLoading === dep.id}
                      onClick={() => handleViewScreenshot(dep.id)}
                    >
                      {screenshotLoading === dep.id
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <><Image className="w-4 h-4 mr-1" /> Screenshot</>}
                    </Button>
                  )}
                </div>
                {dep.remarks && dep.status !== 'pending' && (
                  <p className="text-sm text-muted-foreground mt-2">Remarks: {dep.remarks}</p>
                )}
              </CardHeader>
              {dep.status === 'pending' && (
                <CardContent className="pt-0">
                  <div className="flex gap-3 items-center">
                    <Input
                      placeholder="Remarks (required for rejection)"
                      value={remarksMap[dep.id] ?? ''}
                      onChange={(e) => setRemarksMap(m => ({ ...m, [dep.id]: e.target.value }))}
                      className="flex-1 text-sm"
                    />
                    <Button size="sm" className="bg-success hover:bg-success/90 text-white gap-1"
                      onClick={() => requestAction(dep.id, 'approve')} disabled={approve.isPending || reject.isPending}>
                      <CheckCircle className="w-4 h-4" /> Approve
                    </Button>
                    <Button size="sm" variant="destructive" className="gap-1"
                      onClick={() => requestAction(dep.id, 'reject')} disabled={approve.isPending || reject.isPending}>
                      <XCircle className="w-4 h-4" /> Reject
                    </Button>
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-between items-center text-sm text-muted-foreground pt-2">
          <span>Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
            <span className="flex items-center px-2 font-mono">{page}/{totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
          </div>
        </div>
      )}

      {/* Screenshot modal */}
      {screenshotOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-8"
          onClick={() => setScreenshotOpen(null)}>
          <div className="relative max-w-2xl w-full" onClick={e => e.stopPropagation()}>
            <Button variant="outline" size="sm" className="absolute -top-10 right-0" onClick={() => setScreenshotOpen(null)}>Close</Button>
            <img
              src={screenshotOpen.startsWith('data:') ? screenshotOpen : `data:image/jpeg;base64,${screenshotOpen}`}
              alt="Payment screenshot" className="w-full rounded-xl border border-border"
            />
          </div>
        </div>
      )}

      <AlertDialog
        open={pendingAction !== null}
        onOpenChange={(open) => {
          if (!open && !approve.isPending && !reject.isPending) setPendingAction(null);
        }}
      >
        <AlertDialogContent data-testid="deposit-action-confirmation">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingAction?.action === 'approve' ? 'Confirm deposit approval' : 'Confirm deposit rejection'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingAction?.action === 'approve'
                ? 'This will credit the user wallet. Please check the amount, UTR, and screenshot before continuing.'
                : 'This will reject the deposit request. Please make sure the rejection remarks are correct.'}
              {' '}
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                if (confirmationCountdown > 0) event.preventDefault();
                handleConfirmedAction();
              }}
              disabled={confirmationCountdown > 0 || approve.isPending || reject.isPending}
              className={pendingAction?.action === 'reject' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : 'bg-success text-white hover:bg-success/90'}
              data-testid="deposit-action-confirm"
            >
              {confirmationCountdown > 0
                ? `Wait ${confirmationCountdown}s`
                : pendingAction?.action === 'approve' ? 'Confirm approval' : 'Confirm rejection'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
