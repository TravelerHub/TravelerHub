import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import ErrorBoundary from '../components/ErrorBoundary'

// Suppress React's console.error output for intentional throws in tests
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

// A component that always throws when rendered
function Bomb() {
  throw new Error('Test explosion')
}

// A well-behaved child component
function Fine() {
  return <div>All good</div>
}

describe('ErrorBoundary', () => {
  it('renders children when there is no error', () => {
    render(
      <ErrorBoundary>
        <Fine />
      </ErrorBoundary>
    )
    expect(screen.getByText('All good')).toBeInTheDocument()
  })

  it('shows fallback UI when a child throws', () => {
    render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>
    )
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
  })

  it('resets error state when "Try again" button is clicked', () => {
    // We need a stateful wrapper so we can swap the child after reset
    let shouldThrow = true

    function MaybeThrow() {
      if (shouldThrow) throw new Error('boom')
      return <div>Recovered</div>
    }

    const { rerender } = render(
      <ErrorBoundary>
        <MaybeThrow />
      </ErrorBoundary>
    )

    // Error UI should be visible
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()

    // Stop the child from throwing, then click Try again
    shouldThrow = false
    fireEvent.click(screen.getByText('Try again'))

    // After reset, children should render normally
    rerender(
      <ErrorBoundary>
        <MaybeThrow />
      </ErrorBoundary>
    )
    expect(screen.getByText('Recovered')).toBeInTheDocument()
  })
})
