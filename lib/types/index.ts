// ─── Enums / Union types ────────────────────────────────────────────────────

export type TransactionType = 'credit' | 'debit';

export type TransactionCategory =
  | 'transfer'
  | 'airtime'
  | 'data'
  | 'bills'
  | 'pos'
  | 'atm'
  | 'shopping'
  | 'food'
  | 'transport'
  | 'salary'
  | 'investment'
  | 'loan'
  | 'reversal'
  | 'other';

// ─── Core entities ──────────────────────────────────────────────────────────

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  image?: string | null;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Bank {
  id: string;
  name: string;
  shortCode: string;
  logoUrl?: string;
  color?: string;
}

export interface Account {
  id: string;
  userId: string;
  bankId: string;
  bank?: Bank;
  accountNumber: string;
  accountName: string;
  balance: number;
  currency: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Transaction {
  id: string;
  userId: string;
  accountId?: string;
  account?: Account;
  type: TransactionType;
  amount: number;
  currency: string;
  description: string;
  merchant?: string;
  bank: string;
  accountNumber?: string;
  reference?: string;
  balance?: number;
  date: string;
  rawSms?: string;
  category: TransactionCategory;
  isRecurring?: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── API response wrappers ───────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface ApiError {
  message: string;
  code?: string;
  statusCode: number;
  errors?: Record<string, string[]>;
}

// ─── Auth ────────────────────────────────────────────────────────────────────

// Better Auth GET /api/auth/session response shape
export interface Session {
  session: {
    id: string;
    userId: string;
    token: string;
    expiresAt: string;
    createdAt: string;
    updatedAt: string;
    ipAddress?: string;
    userAgent?: string;
  };
  user: User;
}

// ─── Analytics ───────────────────────────────────────────────────────────────

export interface AnalyticsSummary {
  totalInflow: number;
  totalOutflow: number;
  netBalance: number;
  transactionCount: number;
  period: string;
}

export interface CategoryBreakdown {
  category: TransactionCategory;
  amount: number;
  count: number;
  percentage: number;
}

export interface MonthlyTrend {
  month: string;
  inflow: number;
  outflow: number;
  net: number;
}
