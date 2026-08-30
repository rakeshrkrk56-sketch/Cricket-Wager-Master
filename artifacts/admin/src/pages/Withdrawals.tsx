import { useState } from 'react';
import {
  useAdminListWithdrawals,
  getAdminListWithdrawalsQueryKey,
  useApproveWithdrawal,
  useRejectWithdrawal,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, CheckCircle, XCircle, RefreshCw, Download, Search } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { exportToCsv } from '@/lib/export';
import { useDebounce } from '@/hooks/use-debounce';

type StatusFilter = 'pending' | 'approved' | 'rejected' | 'all';

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-warning/10 text-warning border-warning/30',
  approved: 'bg-success/10 text-success border-success/30',
  rejected: 'bg-destructive/10 text-destructive border-destructive/30',
};
const STATUS_LABEL: Record<string, string> = { pending: 'Pending', approved: 'Approved', rejected: 'Rejected' };

const PAGE_SIZE = 20;

export function Withdrawals() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 400);
  const [page, setPage] = useState(1);
  const [remarksMap, setRemarksMap] = useState<Record<string, string>>({});

  const apiStatus = statusFilter === 'all' ? undefined : statusFilter;
  const qKey = getAdminListWithdrawalsQueryKey({ status: apiStatus, limit: PAGE_SIZE, page, search: debouncedSearch || undefined });

  const { data, isLoading, refetch } = useAdminListWithdrawals(
    { status: apiStatus, limit: PAGE_SIZE, page, search: debouncedSearch || undefined } as any,
    { query: { queryKey: qKey, refetchInterval: 30000 } }
  );
  const approve = useApproveWithdrawal();
  const reject = useRejectWithdrawal();

  const withdrawals = (data as any)?.withdrawals ?? [];
  const total: number = (data as any)?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const handleApprove = (id: string) => {
    approve.mutate(
      { withdrawalId: id, data: { remarks: remarksMap[id] } },
      {
        onSuccess: () => {
          toast({ title: 'Withdrawal approved' });
          queryClient.invalidateQueries({ queryKey: getAdminListWithdrawalsQueryKey() });
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
      { withdrawalId: id, data: { remarks: remarksMap[id] } },
      {
        onSuccess: () => {
          toast({ title: 'Withdrawal rejected', description: 'No funds deducted.' });
          queryClient.invalidateQueries({ queryKey: getAdminListWithdrawalsQueryKey() });
          refetch();
        },
        onError: (err: any) => toast({ variant: 'destructive', title: 'Error', description: err?.data?.error ?? 'Failed' }),
      }
    );
  };

  const handleExport = () => {
    if (!withdrawals.length) return;
    exportToCsv(`withdrawals-${statusFilter}-${format(new Date(), 'yyyy-MM-dd')}.csv`,
      withdrawals.map((w: any) => ({
        id: w.id,
        user: w.user?.phone ?? w.userId,
        name: w.user?.name ?? '',
        amount: w.amount,
        upi_id: w.upiId ?? '',
        status: w.status,
        remarks: w.remarks ?? '',
        created: format(new Date(w.createdAt), 'yyyy-MM-dd HH:mm'),
      }))
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Withdrawals</h1>
          <p className="text-muted-foreground mt-1 text-sm uppercase tracking-wider">Withdrawal Requests</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport} disabled={!withdrawals.length}>
            <Download className="w-4 h-4 mr-2" /> Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
          </Button>
        </div>
      </div>

      <Card className="p-4 flex flex-wrap gap-3 bg-card/80">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by phone or UPI ID..."
            className="pl-9 bg-background"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <Select value={statusFilter} onValueChange={(v: StatusFilter) => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-40 bg-background"><SelectValue /></SelectTrigger>
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
      ) : withdrawals.length === 0 ? (
        <div className="border border-dashed rounded-xl flex items-center justify-center h-32 text-muted-foreground">
          No withdrawals found.
        </div>
      ) : (
        <div className="space-y-4">
          {withdrawals.map((wd: any) => (
            <Card key={wd.id} className="bg-card border-border">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-white font-mono text-xl font-bold">₹{Number(wd.amount).toLocaleString('en-IN')}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${STATUS_BADGE[wd.status]}`}>
                        {STATUS_LABEL[wd.status]}
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground space-y-0.5">
                      <p>
                        <span className="text-foreground font-medium">{wd.user?.phone ?? wd.userId}</span>
                        {wd.user?.name && <span className="ml-2">({wd.user.name})</span>}
                        {wd.user?.walletBalance != null && (
                          <span className="ml-2 text-xs">Bal: ₹{Number(wd.user.walletBalance).toLocaleString('en-IN')}</span>
                        )}
                      </p>
                      {wd.upiId && <p>UPI: <span className="font-mono text-foreground">{wd.upiId}</span></p>}
                      {wd.bankAccount && (
                        <p>Bank: <span className="text-foreground">{(wd.bankAccount as any).accountNumber} / {(wd.bankAccount as any).ifsc}</span></p>
                      )}
                      <p>{format(new Date(wd.createdAt), 'dd MMM yyyy, HH:mm')}</p>
                    </div>
                    {wd.remarks && wd.status !== 'pending' && (
                      <p className="text-sm text-muted-foreground mt-2">Remarks: {wd.remarks}</p>
                    )}
                  </div>
                </div>
              </CardHeader>
              {wd.status === 'pending' && (
                <CardContent className="pt-0">
                  <div className="flex gap-3 items-center">
                    <Input
                      placeholder="Remarks (required for rejection)"
                      value={remarksMap[wd.id] ?? ''}
                      onChange={(e) => setRemarksMap(m => ({ ...m, [wd.id]: e.target.value }))}
                      className="flex-1 text-sm"
                    />
                    <Button size="sm" className="bg-success hover:bg-success/90 text-white gap-1"
                      onClick={() => handleApprove(wd.id)} disabled={approve.isPending}>
                      <CheckCircle className="w-4 h-4" /> Approve
                    </Button>
                    <Button size="sm" variant="destructive" className="gap-1"
                      onClick={() => handleReject(wd.id)} disabled={reject.isPending}>
                      <XCircle className="w-4 h-4" /> Reject
                    </Button>
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

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
    </div>
  );
}
