import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { useNavigate } from "react-router-dom";

export default function AccessDenied() {
    const navigate = useNavigate();

    return (
        <div className="flex h-screen items-center justify-center bg-background">
            <Card className="w-full max-w-md border-red-200 bg-red-50/50 dark:bg-red-900/10 dark:border-red-900/50">
                <CardHeader>
                    <CardTitle className="text-red-600 dark:text-red-400">
                        Zugriff verweigert
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                        Du hast keine Berechtigung, diese Seite aufzurufen.
                    </p>
                    <Button variant="outline" onClick={() => navigate(-1)}>
                        Zurück
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
