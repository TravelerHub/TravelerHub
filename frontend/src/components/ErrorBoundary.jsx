import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("[ErrorBoundary] Caught an error:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#f3f4f6",
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "1rem",
              padding: "2.5rem 2rem",
              maxWidth: "420px",
              width: "100%",
              textAlign: "center",
              boxShadow: "0 4px 24px rgba(0,0,0,0.10)",
              border: "1px solid rgba(0,0,0,0.07)",
            }}
          >
            <div
              style={{
                width: "56px",
                height: "56px",
                borderRadius: "50%",
                background: "#183a37",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 1.25rem",
              }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="28"
                height="28"
                fill="none"
                viewBox="0 0 24 24"
                stroke="#ffffff"
                strokeWidth={1.8}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                />
              </svg>
            </div>

            <h2
              style={{
                fontSize: "1.2rem",
                fontWeight: "700",
                color: "#183a37",
                marginBottom: "0.5rem",
              }}
            >
              Something went wrong
            </h2>
            <p
              style={{
                fontSize: "0.85rem",
                color: "#6b7280",
                marginBottom: "1.75rem",
                lineHeight: "1.5",
              }}
            >
              An unexpected error occurred. You can try again or head back home.
            </p>

            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
              <button
                onClick={() => this.setState({ hasError: false, error: null })}
                style={{
                  padding: "0.6rem 1.4rem",
                  borderRadius: "0.6rem",
                  background: "#183a37",
                  color: "#ffffff",
                  fontWeight: "600",
                  fontSize: "0.875rem",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Try again
              </button>
              <button
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                  window.location.href = "/";
                }}
                style={{
                  padding: "0.6rem 1.4rem",
                  borderRadius: "0.6rem",
                  background: "#f3f4f6",
                  color: "#374151",
                  fontWeight: "600",
                  fontSize: "0.875rem",
                  border: "1px solid #d1d5db",
                  cursor: "pointer",
                }}
              >
                Go home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
