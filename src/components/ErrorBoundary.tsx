import { Component, type ReactNode } from 'react'

/** Shows a readable message instead of a blank screen if a page crashes. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    console.error('Sticky wall crashed:', error)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <main className="phone center">
        <h1>Something went wrong</h1>
        <p>Reload the page to try again. Your draft is saved.</p>
        <button className="primary" onClick={() => window.location.reload()}>
          Reload
        </button>
      </main>
    )
  }
}
