import { useQuery as useTanStackQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { DashboardConfig, Query } from '@/types/dashboard';
import toast from 'react-hot-toast';

// Dashboard hooks
export function useDashboardConfig(id?: string) {
  return useTanStackQuery({
    queryKey: ['dashboard', id],
    queryFn: () => api.getDashboardConfig(id),
  });
}

export function useUpdateDashboard(id: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (config: DashboardConfig) => api.updateDashboard(id, config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dashboard', id] });
      toast.success('Dashboard saved successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to save dashboard: ${error.message}`);
    },
  });
}

export function useSaveDraft() {
  return useMutation({
    mutationFn: (config: DashboardConfig) => api.saveDraft(config),
    onSuccess: () => {
      toast.success('Draft saved', { duration: 2000 });
    },
  });
}

// Widget hooks
export function useWidgetData(widgetId: string, refetchInterval = 30000) {
  return useTanStackQuery({
    queryKey: ['widget', widgetId],
    queryFn: () => api.getWidgetData(widgetId),
    refetchInterval,
  });
}

// Query hooks
export function useQueries(dataSource?: string) {
  return useTanStackQuery({
    queryKey: ['queries', dataSource],
    queryFn: () => api.getQueries(dataSource),
  });
}

export function useSavedQuery(dataSource: string, id: string) {
  return useTanStackQuery({
    queryKey: ['query', dataSource, id],
    queryFn: () => api.getQuery(dataSource, id),
  });
}

export function useCreateQuery(dataSource: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (query: Omit<Query, 'id' | 'createdAt' | 'updatedAt'>) =>
      api.createQuery(dataSource, query),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queries', dataSource] });
      toast.success('Query saved successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to save query: ${error.message}`);
    },
  });
}

// Schema hooks
export function useSchema(dataSource: string) {
  return useTanStackQuery({
    queryKey: ['schema', dataSource],
    queryFn: () => api.getSchema(dataSource),
    staleTime: 5 * 60 * 1000, // 5 minutes (schema doesn't change often)
  });
}

export function useExecuteQuery(dataSource: string) {
  return useMutation({
    mutationFn: (sql: string) => api.executeQuery(dataSource, sql),
  });
}
