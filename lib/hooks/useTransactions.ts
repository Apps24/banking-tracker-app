import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { transactionsApi, TransactionsParams } from '../api/transactions.api';
import { TransactionCategory } from '../types';

export function useTransactions(params?: TransactionsParams) {
  return useQuery({
    queryKey: ['transactions', params],
    queryFn: () => transactionsApi.getAll(params).then((r) => r.data),
  });
}

export function useInfiniteTransactions(params: Omit<TransactionsParams, 'page' | 'limit'>) {
  return useInfiniteQuery({
    queryKey: ['transactions', 'infinite', params],
    queryFn: async ({ pageParam }) =>
      transactionsApi.getAll({ ...params, page: pageParam, limit: 20 }).then((r) => r.data),
    getNextPageParam: (lastPage) => {
      const p = (lastPage as any).pagination;
      if (!p) return undefined;
      return p.hasNext ? p.page + 1 : undefined;
    },
    initialPageParam: 1,
  });
}

export function useTransaction(id: string) {
  return useQuery({
    queryKey: ['transaction', id],
    queryFn: () => transactionsApi.getById(id).then((r) => r.data),
    enabled: !!id,
  });
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => transactionsApi.delete(id),
    // Invalidates all transaction-related queries (regular + infinite)
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['transactions'] }),
  });
}

export function useUpdateTransactionCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, category }: { id: string; category: TransactionCategory }) =>
      transactionsApi.updateCategory(id, category).then((r) => r.data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['transaction', id] });
    },
  });
}
