/* ------------------------------------------------ */
/* REGISTER – ODIN                    */
/* ------------------------------------------------ */

import { useState } from "react";
import { Link } from "react-router-dom";

import { api } from "../../api/api";

import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

import {
  IBX_OPTIONS,
  DEPARTMENT_OPTIONS,
} from "../users/userOptions";

/* ------------------------------------------------ */
/* COMPONENT                                        */
/* ------------------------------------------------ */

export default function Register() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [location, setLocation] = useState(""); // IBX
  const [department, setDepartment] = useState(""); // c-ops / f-ops / other

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  /* ------------------------------------------------ */
  /* HANDLER                                          */
  /* ------------------------------------------------ */

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await api.post("/auth/register", {
        firstName,
        lastName,
        email,
        password,
        ibx: location,
        department,
      });

      setSuccess(true);

      // reset
      setFirstName("");
      setLastName("");
      setEmail("");
      setPassword("");
      setLocation("");
      setDepartment("");
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
        "Registrierung fehlgeschlagen"
      );
    } finally {
      setLoading(false);
    }
  };

  /* ------------------------------------------------ */
  /* RENDER                                           */
  /* ------------------------------------------------ */

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
              Konto registrieren
            </CardTitle>

            <p className="text-sm text-muted-foreground">
              Registrierung erfordert Admin-Freigabe
            </p>
          </CardHeader>

          <CardContent className="space-y-6">
            <form onSubmit={handleRegister} className="space-y-4">
              {/* NAME */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Vorname</Label>
                  <Input
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Nachname</Label>
                  <Input
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              {/* EMAIL */}
              <div className="space-y-2">
                <Label>E-Mail</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              {/* IBX */}
              <div className="space-y-2">
                <Label>Standort (IBX)</Label>
                <Select
                  value={location}
                  onValueChange={setLocation}
                  disabled={loading}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Standort auswählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {IBX_OPTIONS.map((ibx) => (
                      <SelectItem key={ibx} value={ibx}>
                        {ibx}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* DEPARTMENT */}
              <div className="space-y-2">
                <Label>Abteilung</Label>
                <Select
                  value={department}
                  onValueChange={setDepartment}
                  disabled={loading}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Abteilung auswählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {DEPARTMENT_OPTIONS.map((dep) => (
                      <SelectItem
                        key={dep}
                        value={dep.toLowerCase()}
                      >
                        {dep}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* PASSWORD */}
              <div className="space-y-2">
                <Label>Passwort</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              {/* FEEDBACK */}
              {error && (
                <p className="text-sm text-red-500">{error}</p>
              )}

              {success && (
                <p className="text-sm text-green-500">
                  Registrierung erfolgreich – bitte auf Freigabe warten.
                </p>
              )}

              <Button
                type="submit"
                className="w-full h-11"
                disabled={loading}
              >
                {loading
                  ? "Wird gesendet…"
                  : "Registrierung anfragen"}
              </Button>
            </form>

            <div className="text-center text-sm">
              <Link to="/login" className="text-primary hover:underline">
                Zurück zum Login
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
