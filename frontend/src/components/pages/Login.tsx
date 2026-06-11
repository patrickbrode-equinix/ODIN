/* ------------------------------------------------ */
/* LOGIN PAGE – ODIN                  */
/* ------------------------------------------------ */

import { useState, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useLanguage } from "../../context/LanguageContext";
import { validateLoginName } from "../../utils/loginName";
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
  const { t } = useLanguage();
  const copy = {
    loginFailed: t("login.loginFailed"),
    userIdHint: t("login.emailHint"),
    userId: t("login.email"),
    userIdPlaceholder: t("login.emailPlaceholder"),
    userIdInvalid: t("login.userIdInvalid"),
    password: t("login.password"),
    hidePassword: t("login.hidePassword"),
    showPassword: t("login.showPassword"),
    loggingIn: t("login.loggingIn"),
    login: t("login.loginButton"),
    forgotPassword: t("login.forgotPassword"),
    noAccount: t("login.noAccount"),
    register: t("login.register"),
  };

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

  const [loginName, setLoginName] = useState("");
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

    const validation = validateLoginName(loginName);
    if (!validation.ok) {
      setError(copy.userIdInvalid);
      return;
    }

    setLoading(true);

    try {
      await login(validation.value, password);
      navigate(from, { replace: true });
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
        copy.loginFailed
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
      <div className="absolute inset-0 -z-10 bg-black/65 backdrop-blur-[2px]" />

      {/* Animated ambient orbs */}
      <div className="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full bg-[radial-gradient(circle,rgba(0,229,255,0.12),transparent_70%)] blur-[100px] animate-[pulse_8s_ease-in-out_infinite]" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-[radial-gradient(circle,rgba(79,70,229,0.10),transparent_70%)] blur-[90px] animate-[pulse_10s_ease-in-out_infinite_2s]" />
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full bg-[radial-gradient(circle,rgba(0,180,255,0.04),transparent_60%)] blur-[80px]" />

      {/* Login Card */}
      <div className="relative z-10 flex min-h-screen items-center justify-center px-4">
        <Card className="w-full max-w-md overflow-hidden rounded-[28px] border border-cyan-400/20 bg-background/88 backdrop-blur-2xl shadow-[0_40px_100px_rgba(0,0,0,0.5),0_0_64px_rgba(0,180,255,0.12),inset_0_1px_0_rgba(255,255,255,0.08)]">
          {/* Top neon edge */}
          <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent_5%,rgba(0,229,255,0.5)_20%,rgba(0,229,255,0.9)_50%,rgba(0,229,255,0.5)_80%,transparent_95%)] shadow-[0_0_20px_rgba(0,229,255,0.4)]" />

          <CardHeader className="relative text-center space-y-4 pb-2 pt-8">
            {/* Logo with glow ring */}
            <div className="relative mx-auto">
              <div className="absolute inset-0 -m-3 rounded-full bg-[conic-gradient(from_0deg,rgba(0,229,255,0.3),rgba(59,130,246,0.3),rgba(79,70,229,0.3),rgba(0,229,255,0.3))] blur-xl animate-[spin_12s_linear_infinite] opacity-60" />
              <img
                src="/app/ODIN_Logo.png"
                alt="ODIN"
                className="relative mx-auto h-20 w-auto drop-shadow-[0_0_24px_rgba(0,229,255,0.7)]"
              />
            </div>

            {/* App name — premium gradient text */}
            <CardTitle
              className="text-4xl font-black tracking-[0.4em] uppercase bg-gradient-to-r from-cyan-200 via-white to-blue-200 bg-clip-text text-transparent"
              style={{
                textShadow: "0 0 24px rgba(0,229,255,0.5)",
                filter: "drop-shadow(0 0 8px rgba(0,229,255,0.3))",
              }}
            >
              O.D.I.N
            </CardTitle>

            {/* Tagline */}
            <p className="text-[10px] text-cyan-200/50 tracking-[0.28em] uppercase font-bold">
              Operations Dispatching & Intelligence Node
            </p>
          </CardHeader>

          <CardContent className="space-y-6 pb-8">
            {/* Login hint */}
            <div className="flex items-start gap-2 rounded-lg bg-blue-500/10 border border-blue-400/20 p-3">
              <Info className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
              <p className="text-xs text-blue-200/80">{copy.userIdHint}</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="loginName">{copy.userId}</Label>
                <Input
                  id="loginName"
                  type="text"
                  placeholder={copy.userIdPlaceholder}
                  value={loginName}
                  onChange={(e) => setLoginName(e.target.value)}
                  autoComplete="username"
                  autoFocus
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">{copy.password}</Label>
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
                    aria-label={showPassword ? copy.hidePassword : copy.showPassword}
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
                className="w-full h-12 text-base font-bold tracking-wide rounded-xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:via-blue-500 hover:to-indigo-500 text-white shadow-[0_0_24px_rgba(0,180,255,0.3),0_12px_32px_rgba(59,130,246,0.20)] transition-all duration-300 hover:shadow-[0_0_32px_rgba(0,229,255,0.4),0_16px_40px_rgba(59,130,246,0.30)] hover:scale-[1.01]"
                disabled={loading}
              >
                {loading ? copy.loggingIn : copy.login}
              </Button>
            </form>

            <div className="flex flex-col items-center gap-2 text-sm">
              <Link
                to="/forgot-password"
                className="text-muted-foreground hover:text-primary transition"
              >
                {copy.forgotPassword}
              </Link>

              <div className="text-xs text-muted-foreground">
                {copy.noAccount}{" "}
                <Link to="/register" className="text-primary hover:underline">
                  {copy.register}
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
