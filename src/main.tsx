import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from './app/App';
import { ErrorBoundary } from './app/ErrorBoundary';
import { AuthProvider } from './features/auth/AuthProvider';
import { ApiError } from './shared/lib/api';
import './styles/index.css';
import './styles/brand-theme.css';
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 300_000,
      refetchOnWindowFocus: true,
      retry: (count, error) =>
        count < 1 && error instanceof ApiError && (error.status === 0 || error.status >= 500),
    },
    mutations: { retry: false },
  },
});
createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </QueryClientProvider>
  </ErrorBoundary>,
);
