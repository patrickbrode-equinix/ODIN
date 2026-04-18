import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "../../context/LanguageContext";

export default function AccessDenied() {
    const navigate = useNavigate();
    const { t } = useLanguage();

    return (
        <div className="flex h-screen items-center justify-center bg-background">
            <Card className="w-full max-w-md border-red-200 bg-red-50/50 dark:bg-red-900/10 dark:border-red-900/50">
                <CardHeader>
                    <CardTitle className="text-red-600 dark:text-red-400">
                        {t("accessDenied.title")}
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                        {t("accessDenied.message")}
                    </p>
                    <Button variant="outline" onClick={() => navigate(-1)}>
                        {t("accessDenied.backButton")}
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
