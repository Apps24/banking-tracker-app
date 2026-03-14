// ─── Enums / Union types ────────────────────────────────────────────────────
// Must match Prisma enum values in the backend schema exactly (uppercase).

export type TransactionType = 'CREDIT' | 'DEBIT';

export type TransactionCategory =
  | 'FOOD'
  | 'TRANSPORT'
  | 'SHOPPING'
  | 'UTILITIES'
  | 'ENTERTAINMENT'
  | 'HEALTH'
  | 'EDUCATION'
  | 'SALARY'
  | 'TRANSFER'
  | 'ATM'
  | 'EMI'
  | 'OTHER';

// ─── Core entities ──────────────────────────────────────────────────────────

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  image?: string | null;
  avatar?: string | null;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Bank {
  id: string;
  name: string;
  shortCode: string;
  logoUrl?: string | null;
  color?: string;
}

export interface Account {
  id: string;
  bankId: string;
  accountNumber: string;
  accountType: string;
  nickname?: string | null;
}

export interface Transaction {
  id: string;
  userId: string;
  accountId: string;
  account?: Account;
  bankId: string;
  bank?: Bank;
  type: TransactionType;
  amount: number;
  currency: string;
  description: string;
  merchant?: string | null;
  fromIdentifier?: string | null;
  toIdentifier?: string | null;
  transactionMode?: string;
  reference?: string | null;
  balance?: number | null;
  smsDate: string;
  rawSms?: string;
  category: TransactionCategory;
  isVerified?: boolean;
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
  month: number;
  monthName: string;
  credit: number;
  debit: number;
  net: number;
}
