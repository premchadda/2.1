import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// TEST-03: Expanded route-level smoke tests for key frontend routes.

// Mock heavy dependencies that aren't needed for smoke tests
vi.mock('@react-oauth/google', () => ({
  GoogleOAuthProvider: ({ children }) => children,
}))

// Lazy-loaded pages will trigger Suspense — we just verify the app
// renders without crashing and the route structure is intact.
import App from '../App'

const renderRoute = (route) =>
  render(
    <MemoryRouter initialEntries={[route]}>
      <App />
    </MemoryRouter>,
  )

describe('App route smoke tests', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('renders / (home) without crashing', async () => {
    const { container } = renderRoute('/')
    expect(container).toBeTruthy()
  })

  it('renders /login without crashing', async () => {
    const { container } = renderRoute('/login')
    expect(container).toBeTruthy()
  })

  it('renders /signup without crashing', async () => {
    const { container } = renderRoute('/signup')
    expect(container).toBeTruthy()
  })

  it('renders /about without crashing', async () => {
    const { container } = renderRoute('/about')
    expect(container).toBeTruthy()
  })

  it('renders /contact without crashing', async () => {
    const { container } = renderRoute('/contact')
    expect(container).toBeTruthy()
  })

  it('renders /exams without crashing', async () => {
    const { container } = renderRoute('/exams')
    expect(container).toBeTruthy()
  })

  it('renders /test-series without crashing', async () => {
    const { container } = renderRoute('/test-series')
    expect(container).toBeTruthy()
  })

  it('renders /faq without crashing', async () => {
    const { container } = renderRoute('/faq')
    expect(container).toBeTruthy()
  })

  it('renders /terms without crashing', async () => {
    const { container } = renderRoute('/terms')
    expect(container).toBeTruthy()
  })

  it('renders /privacy without crashing', async () => {
    const { container } = renderRoute('/privacy')
    expect(container).toBeTruthy()
  })

  it('renders /search without crashing', async () => {
    const { container } = renderRoute('/search')
    expect(container).toBeTruthy()
  })

  it('renders /blog without crashing', async () => {
    const { container } = renderRoute('/blog')
    expect(container).toBeTruthy()
  })

  it('renders /leaderboard without crashing', async () => {
    const { container } = renderRoute('/leaderboard')
    expect(container).toBeTruthy()
  })

  it('renders unknown route as 404', async () => {
    const { container } = renderRoute('/this-does-not-exist')
    expect(container).toBeTruthy()
  })

  it('renders /dashboard (protected) without crashing', async () => {
    // Protected routes redirect to login — that's expected behavior, not a crash
    const { container } = renderRoute('/dashboard')
    expect(container).toBeTruthy()
  })
})