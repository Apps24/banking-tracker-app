import { apiClient } from './client';
import { AnalyticsSummary } from '../types';

export interface DailyDataPoint {
  date: string;    // "2026-03-07"
  credit: number;
  debit: number;
}

export const analyticsApi = {
  getSummary: (period?: string) =>
    apiClient.get<AnalyticsSummary>('/analytics/summary', { params: { period } }),

  getSummaryByRange: (params: { startDate: string; endDate: string }) =>
    apiClient.get<AnalyticsSummary>('/analytics/summary', { params }),

  getDailyData: (year: number, month: number) =>
    apiClient.get<DailyDataPoint[]>('/analytics/daily', { params: { year, month } }),

  getSpendingByCategory: (params?: { startDate?: string; endDate?: string }) =>
    apiClient.get<{ category: string; amount: number }[]>('/analytics/by-category', { params }),

  getMonthlyTrend: (year?: number) =>
    apiClient.get<{ month: number; monthName: string; credit: number; debit: number; net: number }[]>(
      '/analytics/monthly',
      { params: { year: year ?? new Date().getFullYear() } },
    ),

  getDailyTrend: (params: { startDate: string; endDate: string }) =>
    apiClient.get<DailyDataPoint[]>('/analytics/daily', { params }),

  getBankBreakdown: (params?: { startDate?: string; endDate?: string }) =>
    apiClient.get<{ bank: string; total: number; count: number }[]>('/analytics/by-bank', { params }),
};
