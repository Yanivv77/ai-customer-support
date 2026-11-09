import { Component, type ErrorInfo, type ReactNode } from "react"

import { ErrorState, Panel } from "@/components/primitives"

/** Catches a crash while rendering a page, so the navigation stays usable. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <Panel>
        <ErrorState error={this.state.error} onRetry={() => this.setState({ error: null })} />
      </Panel>
    )
  }
}
