import { useState } from 'react';
import {
  useAdminListDeposits,
  getAdminListDepositsQueryKey,
  useApproveDeposit,
  useRejectDeposit,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, CheckCircle, XCircle, Image, RefreshCw } from 'lucide-react';
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

export function Deposits() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
  const [remarksMap, setRemarksMap] = useState<Record<string, string>>({});
  const [screenshotOpen, setScreenshotOpen] = useState<string | null>(null);

  const { data, isLoading, refetch } = useAdminListDeposits(
    { status: statusFilter, limit: 100 },
    { query: { queryKey: getAdminListDepositsQueryKey({ status: statusFilter, limit: 100 }), refetchInterval: 30000 } }
  );
  const approve = useApproveDeposit();
  const reject = useRejectDeposit();

  const deposits = (data as any)?.deposits ?? [];
  const pending = deposits.filter((d: any) => d.status === 'pending').length;

  const handleApprove = (id: string) => {
    approve.mutate(
      { depositId: id, data: { remarks: remarksMap[id] } },
      {
        onSuccess: () => {
          toast({ title: 'Deposit approved', description: 'Wallet credited successfully.' });
          queryClient.invalidateQueries({ queryKey: ['adminListDeposits'] });
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
      { depositId: id, data: { remarks } },
      {
        onSuccess: () => {
          toast({ title: 'Deposit rejected' });
          queryClient.invalidateQueries({ queryKey: ['adminListDeposits'] });
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
          <h1 className="text-3xl font-bold tracking-tight text-white">Deposits</h1>
          <p className="text-muted-foreground mt-1 text-sm uppercase tracking-wider">
            Deposit Requests (जमा अनुरोध)
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
      ) : deposits.length === 0 ? (
        <Card className="bg-card/50 border-dashed">
          <CardContent className="flex flex-col items-center justify-center h-32 text-muted-foreground">
            <p>No deposits found.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {deposits.map((dep: any) => (
            <Card key={dep.id} className="bg-card border-border">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-white font-mono text-xl font-bold">₹{Number(dep.amount).toLocaleString('en-IN')}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${STATUS_BADGE[dep.status]}`}>
                        {STATUS_LABEL[dep.status]}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                        {dep.method === 'manual' ? 'Manual' : 'UPI App'}
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground space-y-0.5">
                      <p>
                        <span className="text-foreground font-medium">{dep.user?.phone ?? dep.userId}</span>
                        {dep.user?.name && <span className="ml-2 text-muted-foreground">({dep.user.name})</span>}
                      </p>
                      {dep.utrNumber && (
                        <p>UTR: <span className="font-mono text-foreground">{dep.utrNumber}</span></p>
                      )}
                      <p>{format(new Date(dep.createdAt), 'dd MMM yyyy, HH:mm')}</p>
                    </div>
                  </div>
                  {dep.hasScreenshot && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setScreenshotOpen(dep.screenshotBase64 ?? dep.id)}
                    >
                      <Image className="w-4 h-4 mr-1" /> Screenshot
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
                      onChange={(e) => setRemarks(dep.id, e.target.value)}
                      className="flex-1 text-sm"
                    />
                    <Button
                      size="sm"
                      className="bg-success hover:bg-success/90 text-white gap-1"
                      onClick={() => handleApprove(dep.id)}
                      disabled={approve.isPending}
                    >
                      {approve.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="gap-1"
                      onClick={() => handleReject(dep.id)}
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

      {/* Screenshot modal */}
      {screenshotOpen && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-8"
          onClick={() => setScreenshotOpen(null)}
        >
          <div className="relative max-w-2xl w-full" onClick={(e) => e.stopPropagation()}>
            <Button
              variant="outline" size="sm"
              className="absolute -top-10 right-0"
              onClick={() => setScreenshotOpen(null)}
            >
              Close
            </Button>
            {screenshotOpen.startsWith('data:') || screenshotOpen.length > 100 ? (
              <img
                src={screenshotOpen.startsWith('data:') ? screenshotOpen : `data:image/jpeg;base64,${screenshotOpen}`}
                alt="Payment screenshot"
                className="w-full rounded-xl border border-border"
              />
            ) : (
              <div className="text-center text-muted-foreground p-8">Screenshot data unavailable</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
