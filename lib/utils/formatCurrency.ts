import { TransactionType } from '../types';

// ── Indian Rupee (INR) formatters ────────────────────────────────────────────

const inrFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Format as full INR: ₹1,23,456.78
 */
export function formatINR(amount: number): string {
  return inrFormatter.format(amount);
}

/**
 * Format as compact INR with Indian short suffixes:
 *   ≥ 10L  → ₹1.2Cr
 *   ≥ 1L   → ₹1.2L
 *   ≥ 1K   → ₹45K
 *   else   → ₹999.50
 */
export function formatCompact(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';

  if (abs >= 10_000_000) {
    return `${sign}₹${(abs / 10_000_000).toFixed(1)}Cr`;
  }
  if (abs >= 100_000) {
    return `${sign}₹${(abs / 100_000).toFixed(1)}L`;
  }
  if (abs >= 1_000) {
    return `${sign}₹${(abs / 1_000).toFixed(1)}K`;
  }
  return `${sign}₹${abs.toFixed(2)}`;
}

// ── Transaction type colour helpers ─────────────────────────────────────────

/**
 * Returns a NativeWind text colour class for credit/debit.
 * Use directly in className props: <Text className={getTypeColor(tx.type)} />
 */
export function getTypeColor(type: TransactionType): 'text-emerald-400' | 'text-rose-400' {
  return type === 'CREDIT' ? 'text-emerald-400' : 'text-rose-400';
}

/**
 * Returns the sign prefix (+/-) for an amount based on transaction type.
 */
export function getTypePrefix(type: TransactionType): '+' | '-' {
  return type === 'CREDIT' ? '+' : '-';
}

/**
 * Returns a formatted amount string with sign: "+₹1.2L" or "-₹45K"
 */
export function formatTransactionAmount(amount: number, type: TransactionType): string {
  return `${getTypePrefix(type)}${formatCompact(amount)}`;
}
