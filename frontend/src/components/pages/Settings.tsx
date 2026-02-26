/* ------------------------------------------------ */
/* SETTINGS – PAGE (FINAL / CLEAN & CONSISTENT)     */
/* ------------------------------------------------ */

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Switch } from "../ui/switch";
import { Button } from "../ui/button";
import { Bell, Lock, Settings as SettingsIcon } from "lucide-react";
import { EnterprisePageShell, EnterpriseCard, EnterpriseHeader, ENT_SECTION_TITLE } from "../layout/EnterpriseLayout";
import { useTheme } from "../ThemeProvider";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../api/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";

/* ------------------------------------------------ */
/* TYPES                                            */
/* ------------------------------------------------ */

type UserSettings = {
  language: "de" | "en";
  theme: "dark" | "light";
  notify_email: boolean;
  notify_browser: boolean;
  notify_shift_reminder: boolean;
};

type UserMeta = {
  created_at?: string;
  last_login?: string;
  location?: string;
  team?: string;
};

/* ------------------------------------------------ */
/* PAGE                                             */
/* ------------------------------------------------ */

export default function Settings() {
  const { user } = useAuth();
  const { setTheme } = useTheme();

  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [meta, setMeta] = useState<UserMeta | null>(null);
  const [loading, setLoading] = useState(true);

  /* PASSWORD */
  const [pwOpen, setPwOpen] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState<string | null>(null);
  const [pwLoading, setPwLoading] = useState(false);

  /* ------------------------------------------------ */
  /* LOAD SETTINGS + META                             */
  /* ------------------------------------------------ */

  useEffect(() => {
    async function load() {
      const [settingsRes, metaRes] = await Promise.all([
        api.get("/user/settings"),
        api.get("/user/meta"),
      ]);

      setSettings(settingsRes.data);
      setMeta(metaRes.data);
      setTheme(settingsRes.data.theme);
      setLoading(false);
    }

    load();
  }, [setTheme]);

  /* ------------------------------------------------ */
  /* UPDATE SETTINGS                                  */
  /* ------------------------------------------------ */

  async function update(patch: Partial<UserSettings>) {
    if (!settings) return;

    setSettings({ ...settings, ...patch });
    await api.put("/user/settings", patch);

    if (patch.theme) setTheme(patch.theme);
  }

  /* ------------------------------------------------ */
  /* CHANGE PASSWORD                                  */
  /* ------------------------------------------------ */

  async function changePassword() {
    if (!currentPw || !newPw) {
      setPwError("Bitte beide Felder ausfüllen");
      return;
    }

    setPwLoading(true);
    setPwError(null);
    setPwSuccess(null);

    try {
      await api.post("/auth/change-password", {
        currentPassword: currentPw,
        newPassword: newPw,
      });

      setPwSuccess("Passwort erfolgreich geändert");

      setTimeout(() => {
        setPwOpen(false);
        setCurrentPw("");
        setNewPw("");
        setPwSuccess(null);
      }, 1500);
    } catch (err: any) {
      setPwError(
        err?.response?.data?.message ??
        "Passwort konnte nicht geändert werden"
      );
    } finally {
      setPwLoading(false);
    }
  }

  if (loading || !settings || !user) {
    return <div className="text-muted-foreground">Lade Einstellungen…</div>;
  }

  const fullName =
    user.firstName || user.lastName
      ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim()
      : "–";

  const formatDate = (v?: string) =>
    v ? new Date(v).toLocaleString("de-DE") : "–";

  /* ------------------------------------------------ */
  /* RENDER                                           */
  /* ------------------------------------------------ */

  return (
    <EnterprisePageShell>
      {/* HEADER */}
      <EnterpriseHeader
        title="EINSTELLUNGEN"
        subtitle={<span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Persönliche App-Einstellungen</span>}
        icon={<SettingsIcon className="w-5 h-5 text-indigo-400" />}
        rightContent={
          <Button onClick={() => setPwOpen(true)} className="h-7 px-3 text-[11px] font-bold tracking-wider uppercase bg-white/5 hover:bg-white/10 text-white/70 border border-white/10 shadow-sm">
            <Lock className="w-3.5 h-3.5 mr-2" />
            Passwort ändern
          </Button>
        }
      />

      {/* PROFIL */}
      <EnterpriseCard noPadding={false} className="flex flex-col gap-4">
        <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider border-b border-white/10 pb-2">
          Profil
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Info label="Name" value={fullName} />
          <Info label="E-Mail" value={user.email} />
          <Info label="Standort" value={meta?.location} />
          <Info label="Team" value={meta?.team} />
          <Info label="Aktiv seit" value={formatDate(meta?.created_at)} />
          <Info label="Letzter Login" value={formatDate(meta?.last_login)} />
        </div>
      </EnterpriseCard>

      {/* APP */}
      <EnterpriseCard noPadding={false} className="flex flex-col gap-4">
        <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider border-b border-white/10 pb-2">
          App
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label>Sprache</Label>
            <Select
              value={settings.language}
              onValueChange={(v) =>
                update({ language: v as UserSettings["language"] })
              }
            >
              <SelectTrigger className="rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="de">Deutsch</SelectItem>
                <SelectItem value="en">English</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Theme</Label>
            <Select
              value={settings.theme}
              onValueChange={(v) =>
                update({ theme: v as UserSettings["theme"] })
              }
            >
              <SelectTrigger className="rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="light">Light</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </EnterpriseCard>

      {/* NOTIFICATIONS */}
      <EnterpriseCard noPadding={false} className="flex flex-col gap-4">
        <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider border-b border-white/10 pb-2 flex items-center gap-2">
          <Bell className="w-4 h-4" />
          Benachrichtigungen
        </div>
        <div className="space-y-4">
          <NotificationRow
            title="E-Mail Benachrichtigungen"
            value={settings.notify_email}
            onChange={(v) => update({ notify_email: v })}
          />
          <NotificationRow
            title="Browser Benachrichtigungen"
            value={settings.notify_browser}
            onChange={(v) => update({ notify_browser: v })}
          />
          <NotificationRow
            title="Schicht-Erinnerungen"
            value={settings.notify_shift_reminder}
            onChange={(v) => update({ notify_shift_reminder: v })}
          />
        </div>
      </EnterpriseCard>

      {/* PASSWORD DIALOG */}
      <Dialog open={pwOpen} onOpenChange={setPwOpen}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Passwort ändern</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <Input
              type="password"
              placeholder="Aktuelles Passwort"
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
            />
            <Input
              type="password"
              placeholder="Neues Passwort"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
            />

            {pwError && (
              <p className="text-sm text-red-500">{pwError}</p>
            )}
            {pwSuccess && (
              <p className="text-sm text-green-500">{pwSuccess}</p>
            )}

            <Button
              className="w-full"
              onClick={changePassword}
              disabled={pwLoading}
            >
              {pwLoading ? "Bitte warten…" : "Passwort ändern"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </EnterprisePageShell>
  );
}

/* ------------------------------------------------ */
/* COMPONENTS                                       */
/* ------------------------------------------------ */

function Info({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <p className="text-foreground">{value ?? "–"}</p>
    </div>
  );
}

function NotificationRow({
  title,
  value,
  onChange,
}: {
  title: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between p-4 bg-accent/50 rounded-xl border">
      <p className="text-foreground">{title}</p>
      <Switch checked={value} onCheckedChange={onChange} />
    </div>
  );
}
