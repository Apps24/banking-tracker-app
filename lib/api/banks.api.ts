import { apiClient } from './client';

export interface Bank {
  id: string;
  name: string;
  shortCode: string;
  smsPattern: string;
  color: string;
  logoUrl?: string | null;
  isActive: boolean;
  _count?: { accounts: number; transactions: number };
}

export interface CreateBankPayload {
  name: string;
  shortCode: string;
  smsPattern: string;
  color: string;
  logoUrl?: string;
}

type W<T> = { success: boolean; message: string; data: T };

export const banksApi = {
  list: () => apiClient.get<W<Bank[]>>('/banks'),
  create: (data: CreateBankPayload) => apiClient.post<W<Bank>>('/banks', data),
  delete: (id: string) => apiClient.delete(`/banks/${id}`),
};
