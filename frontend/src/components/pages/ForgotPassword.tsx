/* ------------------------------------------------ */
/* FORGOT PASSWORD – ODIN             */
/* ------------------------------------------------ */

import { useState } from "react";
import { Link } from "react-router-dom";
import { KeyRound } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { useLanguage } from "../../context/LanguageContext";

/* ------------------------------------------------ */
/* COMPONENT                                        */
/* ------------------------------------------------ */

export default function ForgotPassword() {
  const { t } = useLanguage();
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
      <div className="absolute inset-0 -z-10 bg-black/65 backdrop-blur-[2px]" />

      {/* Animated ambient orbs */}
      <div className="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full bg-[radial-gradient(circle,rgba(0,229,255,0.12),transparent_70%)] blur-[100px] animate-[pulse_8s_ease-in-out_infinite]" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-[radial-gradient(circle,rgba(79,70,229,0.10),transparent_70%)] blur-[90px] animate-[pulse_10s_ease-in-out_infinite_2s]" />

      <div className="relative z-10 flex min-h-screen items-center justify-center px-4">
        <Card className="w-full max-w-md overflow-hidden rounded-[28px] border border-cyan-400/20 bg-background/88 backdrop-blur-2xl shadow-[0_40px_100px_rgba(0,0,0,0.5),0_0_64px_rgba(0,180,255,0.12),inset_0_1px_0_rgba(255,255,255,0.08)]">
          {/* Top neon edge */}
          <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent_5%,rgba(0,229,255,0.5)_20%,rgba(0,229,255,0.9)_50%,rgba(0,229,255,0.5)_80%,transparent_95%)] shadow-[0_0_20px_rgba(0,229,255,0.4)]" />

          <CardHeader className="relative text-center space-y-4 pb-2 pt-8">
            {/* Icon with glow */}
            <div className="relative mx-auto">
              <div className="absolute inset-0 -m-4 rounded-full bg-[radial-gradient(circle,rgba(0,229,255,0.20),transparent_70%)] blur-xl" />
              <div className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-cyan-400/30 bg-cyan-500/10 shadow-[0_0_32px_rgba(0,229,255,0.2)]">
                <KeyRound className="h-8 w-8 text-cyan-300 drop-shadow-[0_0_12px_rgba(0,229,255,0.8)]" />
              </div>
            </div>

            <CardTitle
              className="text-2xl font-black tracking-[0.15em] uppercase bg-gradient-to-r from-cyan-200 via-white to-blue-200 bg-clip-text text-transparent"
              style={{ filter: "drop-shadow(0 0 8px rgba(0,229,255,0.3))" }}
            >
              {t("forgotPassword.title")}
            </CardTitle>

            <p className="text-[12px] text-muted-foreground/80 max-w-xs mx-auto">
              {t("forgotPassword.subtitle")}
            </p>
          </CardHeader>

          <CardContent className="space-y-6 pb-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email">{t("forgotPassword.email")}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder={t("forgotPassword.emailPlaceholder")}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <Button
                type="submit"
                className="w-full h-12 text-base font-bold tracking-wide rounded-xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:via-blue-500 hover:to-indigo-500 text-white shadow-[0_0_24px_rgba(0,180,255,0.3),0_12px_32px_rgba(59,130,246,0.20)] transition-all duration-300 hover:shadow-[0_0_32px_rgba(0,229,255,0.4),0_16px_40px_rgba(59,130,246,0.30)] hover:scale-[1.01]"
              >
                {t("forgotPassword.submitButton")}
              </Button>
            </form>

            <div className="text-center text-sm">
              <Link
                to="/login"
                className="text-cyan-300/70 hover:text-cyan-200 transition-colors"
              >
                {t("forgotPassword.backToLogin")}
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
