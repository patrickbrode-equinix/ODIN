/* ------------------------------------------------ */
/* REGISTER – ODIN                    */
/* ------------------------------------------------ */

import { useState } from "react";
import { Link } from "react-router-dom";
import { Eye, EyeOff, Info, CheckCircle2 } from "lucide-react";

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
  const [showPassword, setShowPassword] = useState(false);

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
            {/* Registration info */}
            <div className="flex items-start gap-2 rounded-lg bg-blue-500/10 border border-blue-400/20 p-3">
              <Info className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
              <div className="text-xs text-blue-200/80 space-y-1">
                <p>Verwende deine <strong>Firmen-E-Mail-Adresse</strong> (z.B. vorname.nachname@firma.de).</p>
                <p>Nach der Registrierung muss ein Admin dein Konto freigeben, bevor du dich einloggen kannst.</p>
              </div>
            </div>

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
                  placeholder="vorname.nachname@firma.de"
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
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Passwort verbergen" : "Passwort anzeigen"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Mindestens 8 Zeichen mit Groß-/Kleinbuchstaben und einer Zahl.
                </p>
              </div>

              {/* FEEDBACK */}
              {error && (
                <div className="rounded-lg bg-red-500/10 border border-red-400/20 p-3">
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}

              {success && (
                <div className="flex items-start gap-2 rounded-lg bg-green-500/10 border border-green-400/20 p-3">
                  <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 shrink-0" />
                  <div className="text-sm text-green-300">
                    <p className="font-medium">Registrierung erfolgreich!</p>
                    <p className="text-xs text-green-300/70 mt-1">
                      Dein Konto wurde angelegt. Ein Admin wird dein Konto freigeben —
                      du erhältst dann Zugang zum System.
                    </p>
                  </div>
                </div>
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
