import { apiClient } from './client';
import { AnalyticsSummary } from '../types';

export interface DailyDataPoint {
  date: string;    // "2026-03-07"
  credit: number;
  debit: number;
}

// Backend wraps every response: { success, message, data: T }
type W<T> = { success: boolean; message: string; data: T };

export const analyticsApi = {
  getSummary: (period?: string) =>
    apiClient.get<W<AnalyticsSummary>>('/analytics/summary', { params: { period } }),

  getSummaryByRange: (params: { startDate: string; endDate: string }) =>
    apiClient.get<W<AnalyticsSummary>>('/analytics/summary', { params }),

  getDailyData: (year: number, month: number) =>
    apiClient.get<W<DailyDataPoint[]>>('/analytics/daily', { params: { year, month } }),

  getSpendingByCategory: (params?: { startDate?: string; endDate?: string }) =>
    apiClient.get<W<{ category: string; amount: number }[]>>('/analytics/by-category', { params }),

  getMonthlyTrend: (year?: number) =>
    apiClient.get<W<{ month: number; monthName: string; credit: number; debit: number; net: number }[]>>(
      '/analytics/monthly',
      { params: { year: year ?? new Date().getFullYear() } },
    ),

  getDailyTrend: (params: { startDate: string; endDate: string }) =>
    apiClient.get<W<DailyDataPoint[]>>('/analytics/daily', { params }),

  getBankBreakdown: (params?: { startDate?: string; endDate?: string }) =>
    apiClient.get<W<{ bank: string; bankColor: string; total: number; credit: number; debit: number; count: number }[]>>('/analytics/by-bank', { params }),
};
