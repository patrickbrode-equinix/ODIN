/* ------------------------------------------------ */
/* PENDING APPROVAL – USER STATE                    */
/* ------------------------------------------------ */

import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

export default function PendingApproval() {
  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Account wartet auf Freigabe</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            Dein Account wurde erfolgreich erstellt, muss aber noch von einem
            Administrator freigegeben werden.
          </p>
          <p>
            Sobald dein Account freigeschaltet ist, kannst du die Anwendung
            normal nutzen.
          </p>
          <p className="text-xs">
            Bei Fragen wende dich bitte an dein Team oder einen Admin.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
