import React, { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "./ui/button"; // Adjust path if needed

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
    }

    private handleReload = () => {
        window.location.reload();
    };

    public render() {
        if (this.state.hasError) {
            return (
                <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-6 text-center space-y-6">
                    <div className="space-y-2">
                        <h1 className="text-2xl font-bold text-red-500">
                            Ein unerwarteter Fehler ist aufgetreten
                        </h1>
                        <p className="text-muted-foreground max-w-md mx-auto">
                            Die Anwendung konnte nicht geladen werden. Bitte versuche es erneut oder
                            kontaktiere den Support, falls das Problem bestehen bleibt.
                        </p>
                    </div>

                    <div className="p-4 bg-muted/30 rounded-lg border border-border max-w-lg w-full overflow-x-auto text-left">
                        <code className="text-xs text-red-400">
                            {this.state.error?.toString()}
                        </code>
                    </div>

                    <Button onClick={this.handleReload}>Seite neu laden</Button>
                </div>
            );
        }

        return this.props.children;
    }
}
