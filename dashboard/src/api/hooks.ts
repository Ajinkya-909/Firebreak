import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import { ACTIVE_STATUSES, type FeedbackVerdict, type IncidentFilters, type NewService } from './types';

export const useServices = () => useQuery({ queryKey: ['services'], queryFn: api.listServices });

export const useIncidents = (filters: IncidentFilters = {}) =>
  useQuery({ queryKey: ['incidents', filters], queryFn: () => api.listIncidents(filters), refetchInterval: 15_000 });

export const useIncident = (id: string) => useQuery({ queryKey: ['incident', id], queryFn: () => api.getIncident(id) });

/** Live workflow state; polled while the incident is still running. */
export const useIncidentState = (id: string, running: boolean) =>
  useQuery({
    queryKey: ['incident', id, 'state'],
    queryFn: () => api.getIncidentState(id),
    refetchInterval: running ? 5_000 : false,
  });

export const useEvaluation = (days: number) => useQuery({ queryKey: ['evaluation', days], queryFn: () => api.evaluation(days) });

export const isActive = (status: string) => (ACTIVE_STATUSES as string[]).includes(status);

export function useAcknowledge(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.acknowledge(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['incident', id] });
      qc.invalidateQueries({ queryKey: ['incidents'] });
    },
  });
}

export function useFeedback(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { verdict: FeedbackVerdict; comment?: string }) => api.sendFeedback(id, v.verdict, v.comment),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['evaluation'] }),
  });
}

export function useCreateService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: NewService) => api.createService(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['services'] }),
  });
}

export function useUpdateService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<NewService> }) => api.updateService(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['services'] }),
  });
}
