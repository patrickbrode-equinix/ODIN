/* ------------------------------------------------ */
/* REGISTER – ODIN                    */
/* ------------------------------------------------ */

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Eye, EyeOff, Info, CheckCircle2 } from "lucide-react";

import { api } from "../../api/api";
import { useLanguage } from "../../context/LanguageContext";
import { buildLoginNameSuggestion, validateLoginName } from "../../utils/loginName";

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
  const { t } = useLanguage();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [loginName, setLoginName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginNameDirty, setLoginNameDirty] = useState(false);

  const [location, setLocation] = useState(""); // IBX
  const [department, setDepartment] = useState(""); // c-ops / f-ops / other

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const copy = {
    registerFailed: t("register.registerFailed"),
    title: t("register.title"),
    subtitle: t("register.subtitle"),
    infoLineOne: t("register.infoLineOne"),
    infoLineTwo: t("register.infoLineTwo"),
    firstName: t("register.firstName"),
    lastName: t("register.lastName"),
    loginName: t("register.loginName"),
    loginNamePlaceholder: t("register.loginNamePlaceholder"),
    email: t("register.email"),
    emailPlaceholder: t("register.emailPlaceholder"),
    location: t("register.location"),
    locationPlaceholder: t("register.locationPlaceholder"),
    department: t("register.department"),
    departmentPlaceholder: t("register.departmentPlaceholder"),
    password: t("register.password"),
    hidePassword: t("register.hidePassword"),
    showPassword: t("register.showPassword"),
    passwordHint: t("register.passwordHint"),
    successTitle: t("register.successTitle"),
    successBody: t("register.successBody"),
    submitting: t("register.submitting"),
    submit: t("register.submitButton"),
    backToLogin: t("register.backToLogin"),
  };

  useEffect(() => {
    if (loginNameDirty) return;
    setLoginName(buildLoginNameSuggestion(firstName, lastName));
  }, [firstName, lastName, loginNameDirty]);

  /* ------------------------------------------------ */
  /* HANDLER                                          */
  /* ------------------------------------------------ */

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const validation = validateLoginName(loginName);
    if (!validation.ok) {
      setError(t("login.userIdInvalid"));
      return;
    }

    setLoading(true);

    try {
      await api.post("/auth/register", {
        firstName,
        lastName,
        loginName: validation.value,
        email,
        password,
        ibx: location,
        department,
      });

      setSuccess(true);

      // reset
      setFirstName("");
      setLastName("");
      setLoginName("");
      setLoginNameDirty(false);
      setEmail("");
      setPassword("");
      setLocation("");
      setDepartment("");
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
        copy.registerFailed
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
      <div className="absolute inset-0 -z-10 bg-black/65 backdrop-blur-[2px]" />

      {/* Animated ambient orbs */}
      <div className="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full bg-[radial-gradient(circle,rgba(0,229,255,0.12),transparent_70%)] blur-[100px] animate-[pulse_8s_ease-in-out_infinite]" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-[radial-gradient(circle,rgba(79,70,229,0.10),transparent_70%)] blur-[90px] animate-[pulse_10s_ease-in-out_infinite_2s]" />
      <div className="pointer-events-none absolute top-1/3 right-1/4 h-[500px] w-[500px] rounded-full bg-[radial-gradient(circle,rgba(0,180,255,0.05),transparent_60%)] blur-[80px]" />

      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-8">
        <Card className="w-full max-w-lg overflow-hidden rounded-[28px] border border-cyan-400/20 bg-background/88 backdrop-blur-2xl shadow-[0_40px_100px_rgba(0,0,0,0.5),0_0_64px_rgba(0,180,255,0.12),inset_0_1px_0_rgba(255,255,255,0.08)]">
          {/* Top neon edge */}
          <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent_5%,rgba(0,229,255,0.5)_20%,rgba(0,229,255,0.9)_50%,rgba(0,229,255,0.5)_80%,transparent_95%)] shadow-[0_0_20px_rgba(0,229,255,0.4)]" />

          <CardHeader className="relative text-center space-y-4 pb-2 pt-8">
            {/* Logo with glow ring */}
            <div className="relative mx-auto">
              <div className="absolute inset-0 -m-3 rounded-full bg-[conic-gradient(from_0deg,rgba(0,229,255,0.3),rgba(59,130,246,0.3),rgba(79,70,229,0.3),rgba(0,229,255,0.3))] blur-xl animate-[spin_12s_linear_infinite] opacity-60" />
              <img
                src="/app/ODIN_Logo.png"
                alt="ODIN"
                className="relative mx-auto h-16 w-auto drop-shadow-[0_0_24px_rgba(0,229,255,0.7)]"
              />
            </div>

            {/* App name — premium gradient text */}
            <CardTitle
              className="text-3xl font-black tracking-[0.3em] uppercase bg-gradient-to-r from-cyan-200 via-white to-blue-200 bg-clip-text text-transparent"
              style={{
                textShadow: "0 0 24px rgba(0,229,255,0.5)",
                filter: "drop-shadow(0 0 8px rgba(0,229,255,0.3))",
              }}
            >
              {copy.title}
            </CardTitle>

            <p className="text-[11px] text-cyan-200/50 tracking-[0.18em] uppercase font-bold">
              {copy.subtitle}
            </p>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Registration info */}
            <div className="flex items-start gap-2 rounded-lg bg-blue-500/10 border border-blue-400/20 p-3">
              <Info className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
              <div className="text-xs text-blue-200/80 space-y-1">
                <p>{copy.infoLineOne}</p>
                <p>{copy.infoLineTwo}</p>
              </div>
            </div>

            <form onSubmit={handleRegister} className="space-y-4">
              {/* NAME */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{copy.firstName}</Label>
                  <Input
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>

                <div className="space-y-2">
                  <Label>{copy.lastName}</Label>
                  <Input
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>{copy.loginName}</Label>
                <Input
                  type="text"
                  placeholder={copy.loginNamePlaceholder}
                  value={loginName}
                  onChange={(e) => {
                    setLoginNameDirty(true);
                    setLoginName(e.target.value);
                  }}
                  required
                  disabled={loading}
                  autoComplete="username"
                />
              </div>

              {/* EMAIL */}
              <div className="space-y-2">
                <Label>{copy.email}</Label>
                <Input
                  type="email"
                  placeholder={copy.emailPlaceholder}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                />
              </div>

              {/* IBX */}
              <div className="space-y-2">
                <Label>{copy.location}</Label>
                <Select
                  value={location}
                  onValueChange={setLocation}
                  disabled={loading}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder={copy.locationPlaceholder} />
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
                <Label>{copy.department}</Label>
                <Select
                  value={department}
                  onValueChange={setDepartment}
                  disabled={loading}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder={copy.departmentPlaceholder} />
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
                <Label>{copy.password}</Label>
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
                    aria-label={showPassword ? copy.hidePassword : copy.showPassword}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {copy.passwordHint}
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
                    <p className="font-medium">{copy.successTitle}</p>
                    <p className="text-xs text-green-300/70 mt-1">
                      {copy.successBody}
                    </p>
                  </div>
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-12 text-base font-bold tracking-wide rounded-xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:via-blue-500 hover:to-indigo-500 text-white shadow-[0_0_24px_rgba(0,180,255,0.3),0_12px_32px_rgba(59,130,246,0.20)] transition-all duration-300 hover:shadow-[0_0_32px_rgba(0,229,255,0.4),0_16px_40px_rgba(59,130,246,0.30)] hover:scale-[1.01]"
                disabled={loading}
              >
                {loading
                  ? copy.submitting
                  : copy.submit}
              </Button>
            </form>

            <div className="text-center text-sm">
              <Link to="/login" className="text-cyan-300/70 hover:text-cyan-200 transition-colors">
                {copy.backToLogin}
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
