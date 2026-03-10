import { describe, test, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ChakraProvider } from '@chakra-ui/react'
import { system } from '../theme'

vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({
    getToken: vi.fn().mockResolvedValue('mock-token'),
  }),
}))

import DashboardIndex from './DashboardIndex'

function renderIndex() {
  return render(
    <ChakraProvider value={system}>
      <MemoryRouter>
        <DashboardIndex />
      </MemoryRouter>
    </ChakraProvider>,
  )
}

describe('DashboardIndex', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  test('renders dashboard cards from API', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        dashboards: [
          { slug: 'ops', title: 'Operations', description: 'Daily ops' },
          { slug: 'rev', title: 'Revenue', description: 'Revenue tracking' },
        ],
      }),
    }))

    renderIndex()
    await waitFor(() => {
      expect(screen.getByText('Operations')).toBeTruthy()
      expect(screen.getByText('Revenue')).toBeTruthy()
    })
  })

  test('links to correct dashboard slug', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        dashboards: [
          { slug: 'ops', title: 'Operations', description: 'Daily ops' },
        ],
      }),
    }))

    renderIndex()
    await waitFor(() => {
      const link = screen.getByText('Operations').closest('a')
      expect(link?.getAttribute('href')).toBe('/dashboards/ops')
    })
  })

  test('shows empty state when no dashboards', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ dashboards: [] }),
    }))

    renderIndex()
    await waitFor(() => {
      expect(screen.getByText('No dashboards available')).toBeTruthy()
    })
  })

  test('shows loading state initially', () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})))
    renderIndex()
    expect(screen.getByText('Loading...')).toBeTruthy()
  })
})
