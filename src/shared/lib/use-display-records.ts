import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../features/auth/auth-context';
import { request } from './api';
import { applyReferences, collectReferences, type DisplayReference } from './display-references';

export function useDisplayRecords<T>(data: T): T {
  const { user } = useAuth();
  const references = collectReferences(data);
  const query = useQuery({
    queryKey: ['display-references', user?.id, references],
    enabled: Boolean(user) && references.length > 0,
    retry: false,
    staleTime: 60_000,
    queryFn: async ({ signal }) => {
      const labels: DisplayReference[] = [];
      for (let offset = 0; offset < references.length; offset += 100) {
        const result = await request<DisplayReference[]>('/display-references', {
          method: 'POST',
          signal,
          body: { references: references.slice(offset, offset + 100) },
        });
        labels.push(...result.data);
      }
      return labels;
    },
  });
  return applyReferences(data, query.data ?? []);
}
