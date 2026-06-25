// @vitest-environment happy-dom
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ProtectedRoute from './ProtectedRoute.jsx'

// Mock useAuth with a configurable user
const mockUser = vi.fn()
vi.mock('../providers/AuthContext.jsx', () => ({
  useAuth: () => mockUser(),
}))

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
})

const renderRoute = (initialPath, routeChildren) => {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route
            path="/admin"
            element={
              <ProtectedRoute adminOnly>
                <div data-testid="admin-child">Admin Content</div>
              </ProtectedRoute>
            }
          >
            {routeChildren}
          </Route>
          <Route path="/login" element={<div data-testid="login">Login</div>} />
          <Route path="/forbidden-test" element={
            <ProtectedRoute requireAnyPermission="users:write">
              <div data-testid="secret">Secret</div>
            </ProtectedRoute>
          } />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('ProtectedRoute', () => {
  beforeEach(() => {
    mockUser.mockReset()
    mockUser.mockReturnValue({ user: null, loading: false })
  })

  test('redirects unauthenticated users to /login', () => {
    mockUser.mockReturnValue({ user: null, loading: false })
    renderRoute('/admin')
    expect(screen.getByTestId('login')).toBeInTheDocument()
  })

  test('renders children for an authenticated admin', () => {
    mockUser.mockReturnValue({ user: { id: 1, role: 'admin' }, loading: false })
    renderRoute('/admin')
    expect(screen.getByTestId('admin-child')).toBeInTheDocument()
  })

  test('blocks non-admin users from adminOnly routes with a Forbidden page', () => {
    mockUser.mockReturnValue({ user: { id: 2, role: 'user' }, loading: false })
    renderRoute('/admin')
    expect(screen.getByRole('heading', { name: /access denied/i })).toBeInTheDocument()
  })

  test('super_admin passes the adminOnly gate', () => {
    mockUser.mockReturnValue({ user: { id: 1, role: 'super_admin' }, loading: false })
    renderRoute('/admin')
    expect(screen.getByTestId('admin-child')).toBeInTheDocument()
  })

  test('blocks users missing the required permission', () => {
    mockUser.mockReturnValue({
      user: { id: 1, role: 'admin', permissions: ['users:read'] },
      loading: false,
    })
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/forbidden-test']}>
          <Routes>
            <Route path="/forbidden-test" element={
              <ProtectedRoute requireAnyPermission="users:write">
                <div data-testid="secret">Secret</div>
              </ProtectedRoute>
            } />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    )
    expect(screen.getByRole('heading', { name: /access denied/i })).toBeInTheDocument()
  })

  test('allows users that have the required permission', () => {
    mockUser.mockReturnValue({
      user: { id: 1, role: 'admin', permissions: ['users:write', 'users:read'] },
      loading: false,
    })
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/forbidden-test']}>
          <Routes>
            <Route path="/forbidden-test" element={
              <ProtectedRoute requireAnyPermission="users:write">
                <div data-testid="secret">Secret</div>
              </ProtectedRoute>
            } />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    )
    expect(screen.getByTestId('secret')).toBeInTheDocument()
  })
})
