import { apiClient } from './client';
import { Transaction, TransactionCategory } from '../types';

export interface TransactionsParams {
  page?: number;
  limit?: number;
  type?: 'CREDIT' | 'DEBIT';
  bank?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  category?: string;
  categories?: string;  // comma-separated for multi-select
  sort?: string;        // e.g. "date_desc" | "date_asc" | "amount_desc" | "amount_asc"
}

export interface TransactionsPage {
  data: Transaction[];
  total: number;
  page: number;
}

export const transactionsApi = {
  getAll: (params?: TransactionsParams) =>
    apiClient.get<TransactionsPage>('/transactions', { params }),

  getById: (id: string) => apiClient.get<Transaction>(`/transactions/${id}`),

  create: (data: Partial<Transaction>) => apiClient.post<Transaction>('/transactions', data),

  updateCategory: (id: string, category: TransactionCategory) =>
    apiClient.patch<Transaction>(`/transactions/${id}`, { category }),

  parseSms: (sms: string) => apiClient.post<Partial<Transaction>>('/transactions/parse-sms', { sms }),

  batchSms: (messages: { sender: string; body: string; receivedAt: string }[]) =>
    apiClient.post<Transaction[]>('/transactions/sms/batch', { messages }),

  delete: (id: string) => apiClient.delete(`/transactions/${id}`),
};
