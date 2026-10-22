import { Component } from 'react'
import type { ReactNode } from 'react'

interface Props {
  fallback: ReactNode
  children: ReactNode
}

/** Keeps a failed part, such as a lazily loaded chunk after a new deployment, from blanking the page. */
export class ErrorBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}
