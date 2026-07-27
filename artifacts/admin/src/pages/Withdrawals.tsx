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
import { Loader2, CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

type StatusFilter = 'pending' | 'approved' | 'rejected' | undefined;

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-warning/10 text-warning border-warning/30',
  approved: 'bg-success/10 text-success border-success/30',
  rejected: 'bg-destructive/10 text-destructive border-destructive/30',
};
const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending', approved: 'Approved', rejected: 'Rejected',
};

export function Withdrawals() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
  const [remarksMap, setRemarksMap] = useState<Record<string, string>>({});

  const { data, isLoading, refetch } = useAdminListWithdrawals(
    { status: statusFilter, limit: 100 },
    { query: { queryKey: getAdminListWithdrawalsQueryKey({ status: statusFilter, limit: 100 }), refetchInterval: 30000 } }
  );
  const approve = useApproveWithdrawal();
  const reject = useRejectWithdrawal();

  const withdrawals = (data as any)?.withdrawals ?? [];
  const pending = withdrawals.filter((w: any) => w.status === 'pending').length;

  const handleApprove = (id: string) => {
    approve.mutate(
      { withdrawalId: id, data: { remarks: remarksMap[id] } },
      {
        onSuccess: () => {
          toast({ title: 'Withdrawal approved', description: 'Wallet debited and funds sent.' });
          queryClient.invalidateQueries({ queryKey: ['adminListWithdrawals'] });
          refetch();
        },
        onError: (err: any) => toast({ title: 'Error', description: err?.data?.error ?? 'Failed', variant: 'destructive' }),
      }
    );
  };

  const handleReject = (id: string) => {
    const remarks = remarksMap[id];
    if (!remarks?.trim()) { toast({ title: 'Remarks required', description: 'Enter a reason for rejection.', variant: 'destructive' }); return; }
    reject.mutate(
      { withdrawalId: id, data: { remarks } },
      {
        onSuccess: () => {
          toast({ title: 'Withdrawal rejected', description: 'No funds deducted.' });
          queryClient.invalidateQueries({ queryKey: ['adminListWithdrawals'] });
          refetch();
        },
        onError: (err: any) => toast({ title: 'Error', description: err?.data?.error ?? 'Failed', variant: 'destructive' }),
      }
    );
  };

  const setRemarks = (id: string, val: string) =>
    setRemarksMap((prev) => ({ ...prev, [id]: val }));

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Withdrawals</h1>
          <p className="text-muted-foreground mt-1 text-sm uppercase tracking-wider">
            Withdrawal Requests (निकासी अनुरोध)
            {pending > 0 && <span className="ml-2 text-warning font-semibold">{pending} pending</span>}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="w-4 h-4 mr-2" /> Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {(['pending', 'approved', 'rejected', undefined] as const).map((s) => (
          <Button
            key={String(s)}
            size="sm"
            variant={statusFilter === s ? 'default' : 'outline'}
            onClick={() => setStatusFilter(s)}
          >
            {s === undefined ? 'All' : STATUS_LABEL[s]}
          </Button>
        ))}
      </div>

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
                    <div className="flex items-center gap-2 mb-1">
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
                          <span className="ml-2 text-xs text-muted-foreground">
                            Balance: ₹{Number(wd.user.walletBalance).toLocaleString('en-IN')}
                          </span>
                        )}
                      </p>
                      {wd.upiId && (
                        <p>UPI: <span className="font-mono text-foreground">{wd.upiId}</span></p>
                      )}
                      {wd.bankAccount && (
                        <p>
                          Bank: <span className="text-foreground">{(wd.bankAccount as any).accountNumber}</span>
                          {' / '}<span className="text-foreground">{(wd.bankAccount as any).ifsc}</span>
                        </p>
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
                      onChange={(e) => setRemarks(wd.id, e.target.value)}
                      className="flex-1 text-sm"
                    />
                    <Button
                      size="sm"
                      className="bg-success hover:bg-success/90 text-white gap-1"
                      onClick={() => handleApprove(wd.id)}
                      disabled={approve.isPending}
                    >
                      {approve.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="gap-1"
                      onClick={() => handleReject(wd.id)}
                      disabled={reject.isPending}
                    >
                      {reject.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                      Reject
                    </Button>
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
