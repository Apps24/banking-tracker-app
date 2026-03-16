import { apiClient } from './client';
import { Transaction, TransactionCategory } from '../types';

export interface TransactionsParams {
  page?: number;
  limit?: number;
  type?: 'CREDIT' | 'DEBIT';
  bankId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  categories?: string;  // comma-separated, e.g. "FOOD,SHOPPING"
  sortBy?: 'smsDate' | 'amount' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

export interface TransactionsPage {
  data: Transaction[];
  total: number;
  page: number;
}

export const transactionsApi = {
  getAll: (params?: TransactionsParams) =>
    apiClient.get<TransactionsPage>('/transactions', { params }),

  getById: (id: string) => apiClient.get<{ success: boolean; data: Transaction }>(`/transactions/${id}`),

  create: (data: {
    type: 'CREDIT' | 'DEBIT';
    amount: number;
    bankId: string;
    date: string;
    description?: string;
    merchant?: string;
    category: string;
    transactionMode?: string;
  }) => apiClient.post<Transaction>('/transactions', data),

  updateCategory: (id: string, category: TransactionCategory) =>
    apiClient.patch<Transaction>(`/transactions/${id}`, { category }),

  parseSms: (sms: string) => apiClient.post<Partial<Transaction>>('/transactions/parse-sms', { sms }),

  batchSms: (messages: { sender: string; body: string; receivedAt: string }[]) =>
    apiClient.post<Transaction[]>('/transactions/sms/batch', { messages }),

  delete: (id: string) => apiClient.delete(`/transactions/${id}`),
};
