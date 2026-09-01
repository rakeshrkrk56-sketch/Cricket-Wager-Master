import { and, asc, eq, sql } from "drizzle-orm";
import { transactionsTable, withdrawalsTable } from "@workspace/db";

type QueryExecutor = {
  select: (...args: any[]) => any;
};

export type WalletAccounting = {
  depositTotal: number;
  depositBalance: number;
  withdrawTotal: number;
  winTotal: number;
  bonusTotal: number;
  bonusBalance: number;
  pendingWithdrawalTotal: number;
  withdrawableWinnings: number;
};

/**
 * Deposit and bonus funds remain playable but are not withdrawable.
 * Only recorded winnings can be withdrawn, subject to the user's current
 * wallet balance and already-pending withdrawal requests.
 */
export async function getWalletAccounting(
  executor: QueryExecutor,
  userId: string,
  currentBalance: number,
): Promise<WalletAccounting> {
  const transactions = await executor
    .select({
      id: transactionsTable.id,
      type: transactionsTable.type,
      amount: transactionsTable.amount,
      createdAt: transactionsTable.createdAt,
    })
    .from(transactionsTable)
    .where(eq(transactionsTable.userId, userId))
    .orderBy(asc(transactionsTable.createdAt), asc(transactionsTable.id));

  const [pending] = await executor
    .select({
      pendingWithdrawalTotal: sql<string>`coalesce(sum(${withdrawalsTable.amount}), 0)`,
    })
    .from(withdrawalsTable)
    .where(and(
      eq(withdrawalsTable.userId, userId),
      eq(withdrawalsTable.status, "pending"),
    ));

  let depositTotalCents = 0;
  let depositBalanceCents = 0;
  let withdrawTotalCents = 0;
  let winTotalCents = 0;
  let winningsBalanceCents = 0;
  let bonusTotalCents = 0;
  let bonusBalanceCents = 0;

  const toCents = (amount: unknown) => Math.max(0, Math.round(Number(amount) * 100));
  const consumePlayableFunds = (amountCents: number) => {
    let remaining = amountCents;
    const fromDeposit = Math.min(depositBalanceCents, remaining);
    depositBalanceCents -= fromDeposit;
    remaining -= fromDeposit;
    const fromBonus = Math.min(bonusBalanceCents, remaining);
    bonusBalanceCents -= fromBonus;
    remaining -= fromBonus;
    return remaining;
  };

  for (const transaction of transactions) {
    const amountCents = toCents(transaction.amount);
    switch (transaction.type) {
      case "deposit":
        depositTotalCents += amountCents;
        depositBalanceCents += amountCents;
        break;
      case "bonus":
        bonusTotalCents += amountCents;
        bonusBalanceCents += amountCents;
        break;
      case "win":
        winTotalCents += amountCents;
        winningsBalanceCents += amountCents;
        break;
      case "withdraw":
        withdrawTotalCents += amountCents;
        // Approved withdrawals are only allowed to consume winnings.
        // This also keeps deposit and bonus funds non-withdrawable.
        winningsBalanceCents = Math.max(0, winningsBalanceCents - amountCents);
        break;
      case "bet_placed":
      case "loss":
        // Deposit and bonus funds are consumed before winnings.
        const winningsConsumed = consumePlayableFunds(amountCents);
        if (winningsConsumed > 0) {
          winningsBalanceCents = Math.max(0, winningsBalanceCents - winningsConsumed);
        }
        break;
      default:
        break;
    }
  }

  const depositTotal = depositTotalCents / 100;
  const depositBalance = depositBalanceCents / 100;
  const withdrawTotal = withdrawTotalCents / 100;
  const winTotal = winTotalCents / 100;
  const bonusTotal = bonusTotalCents / 100;
  const bonusBalance = bonusBalanceCents / 100;
  const pendingWithdrawalTotal = Number(pending?.pendingWithdrawalTotal ?? 0);
  const winningsRemaining = Math.max(0, winningsBalanceCents / 100 - pendingWithdrawalTotal);
  const balanceRemaining = Math.max(0, currentBalance - pendingWithdrawalTotal);

  return {
    depositTotal,
    depositBalance,
    withdrawTotal,
    winTotal,
    bonusTotal,
    bonusBalance,
    pendingWithdrawalTotal,
    withdrawableWinnings: Math.max(0, Math.min(winningsRemaining, balanceRemaining)),
  };
}