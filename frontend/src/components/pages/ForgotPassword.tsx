/* ------------------------------------------------ */
/* FORGOT PASSWORD – ODIN             */
/* ------------------------------------------------ */

import { useState } from "react";
import { Link } from "react-router-dom";

import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

/* ------------------------------------------------ */
/* COMPONENT                                        */
/* ------------------------------------------------ */

export default function ForgotPassword() {
  const [email, setEmail] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // später Backend-Anbindung
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      {/* Background */}
      <div
        className="absolute inset-0 -z-20 bg-cover bg-center"
        style={{ backgroundImage: "url('/app/login-background.jpg')" }}
      />
      <div className="absolute inset-0 -z-10 bg-black/60 backdrop-blur-[1px]" />

      <div className="relative z-10 flex min-h-screen items-center justify-center px-4">
        <Card className="w-full max-w-md border border-border/50 bg-background/85 backdrop-blur-xl shadow-2xl">
          <CardHeader className="text-center space-y-4">
            <img
              src="/app/Dispatcher-transparent.png"
              alt="ODIN"
              className="mx-auto h-14 w-auto"
            />

            <CardTitle className="text-2xl font-bold">
              Passwort zurücksetzen
            </CardTitle>

            <p className="text-sm text-muted-foreground">
              Du erhältst einen Reset-Link per E-Mail
            </p>
          </CardHeader>

          <CardContent className="space-y-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-Mail</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="z. B. user@firma.de"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <Button type="submit" className="w-full h-11">
                Reset-Link senden
              </Button>
            </form>

            <div className="text-center text-sm">
              <Link
                to="/login"
                className="text-primary hover:underline"
              >
                Zurück zum Login
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
