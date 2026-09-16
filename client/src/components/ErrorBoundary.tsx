import { AlertTriangle, RotateCcw } from "lucide-react";
import { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

// Last line of defense for render errors. Users get a friendly screen;
// the details go to the console and to Sentry when it's configured
// (see main.tsx). Stack traces are only shown in local development —
// in production they can reveal file paths and internals.
class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack);
    (window as any).__sentry?.captureException?.(error, { extra: { componentStack: info.componentStack } });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center min-h-screen p-8 bg-background">
          <div className="flex flex-col items-center text-center w-full max-w-md">
            <span className="w-16 h-16 rounded-2xl bg-orange-50 text-accent flex items-center justify-center mb-6">
              <AlertTriangle size={30} />
            </span>
            <h2 className="text-xl font-black text-primary mb-2">Algo salió mal</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Ya quedó registrado para revisarlo. Recargá la página para seguir.
            </p>
            {import.meta.env.DEV && this.state.error && (
              <pre className="w-full text-left text-xs text-muted-foreground bg-muted rounded-xl p-3 overflow-auto mb-6 max-h-48">
                {this.state.error.stack}
              </pre>
            )}
            <button
              onClick={() => window.location.reload()}
              className="tap-scale inline-flex items-center gap-2 px-6 py-3 rounded-full bg-accent hover:bg-accent/90 text-white font-bold border-0 cursor-pointer"
            >
              <RotateCcw size={16} />
              Recargar
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
