import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from '../src/App';

vi.mock('../src/shared/providers/AuthContext', () => ({
  useAuth: () => ({ user: null, loading: false }),
  AuthProvider: ({ children }) => children,
}));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

import { HelmetProvider } from 'react-helmet-async';

describe('App', () => {
  test('renders without throwing', () => {
    render(
      <HelmetProvider>
        <QueryClientProvider client={queryClient}>
          <MemoryRouter>
            <App />
          </MemoryRouter>
        </QueryClientProvider>
      </HelmetProvider>
    );
    expect(document.body).toBeInTheDocument();
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
  });
});
