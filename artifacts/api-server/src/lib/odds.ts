export const HOUSE_EDGE = 0.075; // 7.5%
export const MIN_ODDS = 1.05;
export const MAX_ODDS = 2.50;
export const DEFAULT_ODDS = 1.90;

/**
 * Calculate dynamic odds based on pool sizes with house edge.
 * Formula: odds = (totalPool * (1 - houseEdge)) / sidePool
 * Clamped to [MIN_ODDS, MAX_ODDS]. Defaults to 1.90/1.90 when either pool is empty.
 */
export function calculateOdds(
  yesPool: number,
  noPool: number,
  houseEdge = HOUSE_EDGE
): { yesOdds: number; noOdds: number } {
  const totalPool = yesPool + noPool;
  if (totalPool === 0 || yesPool === 0 || noPool === 0) {
    return { yesOdds: DEFAULT_ODDS, noOdds: DEFAULT_ODDS };
  }
  const effective = totalPool * (1 - houseEdge);
  const rawYes = effective / yesPool;
  const rawNo = effective / noPool;
  return {
    yesOdds: Math.round(Math.max(MIN_ODDS, Math.min(MAX_ODDS, rawYes)) * 100) / 100,
    noOdds: Math.round(Math.max(MIN_ODDS, Math.min(MAX_ODDS, rawNo)) * 100) / 100,
  };
}

/** Calculate platform fee and net profit for a bet */
export function calculatePayout(amount: number, odds: number) {
  const grossReturn = amount * odds;
  const platformFee = amount * HOUSE_EDGE;
  const netProfit = grossReturn - amount - platformFee;
  return {
    betAmount: amount,
    estimatedReturn: Math.round(grossReturn * 100) / 100,
    platformFee: Math.round(platformFee * 100) / 100,
    netProfit: Math.round(netProfit * 100) / 100,
  };
}
