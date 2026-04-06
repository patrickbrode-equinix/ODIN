/* ------------------------------------------------ */
/* LOGIN PAGE – ODIN                  */
/* ------------------------------------------------ */

import { useState, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { Eye, EyeOff, Info } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

/* ------------------------------------------------ */
/* LOGIN PAGE COMPONENT                             */
/* ------------------------------------------------ */

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated } = useAuth();

  const from = location.state?.from?.pathname || "/dashboard";

  // Redirect to original destination if already authenticated (e.g. restored from localStorage)
  useEffect(() => {
    if (isAuthenticated) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, from]);

  /* ------------------------------------------------ */
  /* STATE                                           */
  /* ------------------------------------------------ */

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  /* ------------------------------------------------ */
  /* LOGIN HANDLER                                   */
  /* ------------------------------------------------ */

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
        "Login fehlgeschlagen. Bitte prüfen."
      );
    } finally {
      setLoading(false);
    }
  };

  /* ------------------------------------------------ */
  /* RENDER                                          */
  /* ------------------------------------------------ */

  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      {/* Background */}
      <div
        className="absolute inset-0 -z-20 bg-cover bg-center"
        style={{ backgroundImage: "url('/app/login-background.jpg')" }}
      />
      <div className="absolute inset-0 -z-10 bg-black/60 backdrop-blur-[1px]" />

      {/* Login Card */}
      <div className="relative z-10 flex min-h-screen items-center justify-center px-4">
        <Card className="w-full max-w-md border border-border/50 bg-background/85 backdrop-blur-xl shadow-2xl">
          <CardHeader className="text-center space-y-3 pb-2">
            {/* Logo */}
            <img
              src="/app/ODIN_Logo.png"
              alt="ODIN"
              className="mx-auto h-16 w-auto drop-shadow-[0_0_12px_rgba(0,216,255,0.5)]"
            />

            {/* App name — subtle enterprise glow */}
            <CardTitle
              className="text-3xl font-bold tracking-[0.35em] uppercase"
              style={{
                textShadow:
                  "0 0 18px rgba(99,179,237,0.50), 0 0 4px rgba(99,179,237,0.25)",
              }}
            >
              O.D.I.N
            </CardTitle>

            {/* Tagline */}
            <p className="text-xs text-muted-foreground tracking-widest uppercase">
              Operations Dispatching and Intelligence Node
            </p>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Login hint */}
            <div className="flex items-start gap-2 rounded-lg bg-blue-500/10 border border-blue-400/20 p-3">
              <Info className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
              <p className="text-xs text-blue-200/80">
                Melde dich mit deiner <strong>Firmen-E-Mail-Adresse</strong> an.
                Falls du noch kein Konto hast, kannst du dich unten registrieren.
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email">E-Mail</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="vorname.nachname@firma.de"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  autoFocus
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Passwort</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
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
              </div>

              {error && (
                <div className="rounded-lg bg-red-500/10 border border-red-400/20 p-3">
                  <p className="text-sm text-red-400 text-center">{error}</p>
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-11 text-base"
                disabled={loading}
              >
                {loading ? "Anmelden…" : "Login"}
              </Button>
            </form>

            <div className="flex flex-col items-center gap-2 text-sm">
              <Link
                to="/forgot-password"
                className="text-muted-foreground hover:text-primary transition"
              >
                Passwort vergessen?
              </Link>

              <div className="text-xs text-muted-foreground">
                Noch kein Konto?{" "}
                <Link to="/register" className="text-primary hover:underline">
                  Registrieren
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
