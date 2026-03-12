import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '../api/analytics.api';

export function useSummary(params: { startDate: string; endDate: string }) {
  return useQuery({
    queryKey: ['summary', params.startDate, params.endDate],
    queryFn: () => analyticsApi.getSummaryByRange(params).then((r) => r.data.data),
  });
}

export function useDailyData(year: number, month: number) {
  return useQuery({
    queryKey: ['dailyData', year, month],
    queryFn: () => analyticsApi.getDailyData(year, month).then((r) => r.data.data),
  });
}

export function useCategoryBreakdown(params: { startDate: string; endDate: string }) {
  return useQuery({
    queryKey: ['categoryBreakdown', params.startDate, params.endDate],
    queryFn: () => analyticsApi.getSpendingByCategory(params).then((r) => r.data.data),
  });
}

export function useMonthlyTrend(year: number = new Date().getFullYear()) {
  return useQuery({
    queryKey: ['monthlyTrend', year],
    queryFn: () => analyticsApi.getMonthlyTrend(year).then((r) => r.data.data),
  });
}

export function useDailyTrend(params: { startDate: string; endDate: string }) {
  return useQuery({
    queryKey: ['dailyTrend', params.startDate, params.endDate],
    queryFn: () => analyticsApi.getDailyTrend(params).then((r) => r.data.data),
  });
}

export function useBankBreakdown(params: { startDate: string; endDate: string }) {
  return useQuery({
    queryKey: ['bankBreakdown', params.startDate, params.endDate],
    queryFn: () => analyticsApi.getBankBreakdown(params).then((r) => r.data.data),
  });
}
