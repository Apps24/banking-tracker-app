export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';
export const APP_NAME = process.env.EXPO_PUBLIC_APP_NAME ?? 'BankTracker';

// SecureStore keys — tokens NEVER go to AsyncStorage
export const SECURE_KEYS = {
  SESSION_TOKEN: 'bt_session_token',  // Better Auth long-lived session token (30 days)
  USER_DATA: 'bt_user_data',
  BIOMETRIC_ENABLED: 'bt_biometric_enabled',
} as const;

// ── Consistent query key arrays used across all hooks ────────────────────────
export const QUERY_KEYS = {
  // Transactions
  transactions:         ['transactions'] as const,
  transactionsInfinite: ['transactions', 'infinite'] as const,
  transaction:          (id: string) => ['transaction', id] as const,

  // Analytics
  summary:           (start: string, end: string) => ['summary', start, end] as const,
  dailyData:         (year: number, month: number) => ['dailyData', year, month] as const,
  dailyTrend:        (start: string, end: string) => ['dailyTrend', start, end] as const,
  categoryBreakdown: (start: string, end: string) => ['categoryBreakdown', start, end] as const,
  monthlyTrend:      (months: number) => ['monthlyTrend', months] as const,
  bankBreakdown:     (start: string, end: string) => ['bankBreakdown', start, end] as const,

  // Other
  banks: ['banks'] as const,
};

export const SUPPORTED_BANKS = [
  'GTBank',
  'Access Bank',
  'Zenith Bank',
  'First Bank',
  'UBA',
  'Sterling Bank',
  'Fidelity Bank',
  'Union Bank',
] as const;
