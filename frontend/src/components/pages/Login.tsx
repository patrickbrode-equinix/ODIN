/* ------------------------------------------------ */
/* LOGIN PAGE – ODIN                  */
/* ------------------------------------------------ */

import { useState, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

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
            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email">E-Mail</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  autoFocus
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Passwort</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </div>

              {error && (
                <p className="text-sm text-red-500 text-center">{error}</p>
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
