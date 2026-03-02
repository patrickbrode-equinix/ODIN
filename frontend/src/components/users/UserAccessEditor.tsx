/* ———————————————————————————————— */
/* USER ACCESS EDITOR – ABTEILUNGSSTANDARD + OVERRIDES */
/* FINAL: none | view | write                          */
/* ———————————————————————————————— */

import { useEffect, useMemo, useState } from "react";
import { api } from "../../api/api";

import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

import type { AccessLevel } from "../../context/AuthContext";
import { PAGE_DEFS } from "../../config/navigation";

/* ———————————————————————————————— */
/* TYPES                                            */
/* ———————————————————————————————— */

type GroupRow = {
  key: string;
  label: string;
  policy: Record<string, AccessLevel>;
};

type UserAccessOverrideResponse = {
  id: number;
  group: string;
  accessOverride: Record<string, AccessLevel>;
};

type UserAccessEditorProps = {
  userId: number;
  userEmail: string;
  userGroup: string;
};

type OverrideValue = "__default__" | AccessLevel;

/* ———————————————————————————————— */
/* HELPERS                                          */
/* ———————————————————————————————— */

function normalizeKey(input: string) {
  return String(input || "")
    .toLowerCase()
    .trim()
    .replace(/_/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function safeLevel(level: any): AccessLevel {
  if (level === "view" || level === "write") return level;
  return "none";
}

function levelLabel(level: AccessLevel) {
  switch (level) {
    case "view":
      return "Lesen";
    case "write":
      return "Schreiben";
    default:
      return "Kein Zugriff";
  }
}

/* Ensure FULL policy shape */
function normalizePolicy(
  raw?: Record<string, AccessLevel>
): Record<string, AccessLevel> {
  const base: Record<string, AccessLevel> = {};

  PAGE_DEFS.forEach((p) => {
    base[p.key] = safeLevel(raw?.[p.key]);
  });

  return base;
}

/* ———————————————————————————————— */
/* COMPONENT                                        */
/* ———————————————————————————————— */

export function UserAccessEditor({
  userId,
  userEmail,
  userGroup,
}: UserAccessEditorProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [groupPolicy, setGroupPolicy] = useState<Record<string, AccessLevel>>(
    {}
  );
  const [override, setOverride] = useState<Record<string, AccessLevel>>({});

  const normalizedGroup = useMemo(
    () => normalizeKey(userGroup),
    [userGroup]
  );

  /* ------------------------------------------------ */
  /* LOAD DATA                                       */
  /* ------------------------------------------------ */

  const load = async () => {
    setLoading(true);
    setError("");

    try {
      const groupsRes = await api.get<GroupRow[]>("/groups");
      const groups = Array.isArray(groupsRes.data) ? groupsRes.data : [];

      const groupRow = groups.find(
        (g) => normalizeKey(g.key) === normalizedGroup
      );

      setGroupPolicy(normalizePolicy(groupRow?.policy));

      const overrideRes = await api.get<UserAccessOverrideResponse>(
        `/users/${userId}/access-override`
      );

      setOverride(overrideRes.data?.accessOverride || {});
    } catch (e: any) {
      setError(
        e?.response?.data?.message || "Konnte User-Rechte nicht laden"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!userId) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  /* ------------------------------------------------ */
  /* VIEW MODEL                                      */
  /* ------------------------------------------------ */

  const rows = useMemo(() => {
    return PAGE_DEFS.map((p) => {
      const base = safeLevel(groupPolicy[p.key]);
      const hasOverride = Object.prototype.hasOwnProperty.call(
        override || {},
        p.key
      );

      const selected: OverrideValue = hasOverride
        ? safeLevel(override[p.key])
        : "__default__";

      return {
        key: p.key,
        label: p.label,
        base,
        selected,
      };
    });
  }, [groupPolicy, override]);

  /* ------------------------------------------------ */
  /* CHANGE HANDLER                                  */
  /* ------------------------------------------------ */

  function setOverrideValue(pageKey: string, value: OverrideValue) {
    setOverride((prev) => {
      const next = { ...(prev || {}) };

      if (value === "__default__") {
        delete next[pageKey];
        return next;
      }

      next[pageKey] = value;
      return next;
    });
  }

  /* ------------------------------------------------ */
  /* SAVE / RESET                                    */
  /* ------------------------------------------------ */

  async function save() {
    setSaving(true);
    setError("");

    try {
      await api.put(`/users/${userId}/access-override`, {
        accessOverride: override || {},
      });
      await load();
    } catch (e: any) {
      setError(
        e?.response?.data?.message || "Konnte Änderungen nicht speichern"
      );
    } finally {
      setSaving(false);
    }
  }

  async function resetOverrides() {
    setSaving(true);
    setError("");

    try {
      await api.put(`/users/${userId}/access-override`, {
        accessOverride: {},
      });
      setOverride({});
      await load();
    } catch (e: any) {
      setError(
        e?.response?.data?.message || "Konnte Overrides nicht zurücksetzen"
      );
    } finally {
      setSaving(false);
    }
  }

  /* ------------------------------------------------ */
  /* RENDER                                          */
  /* ------------------------------------------------ */

  return (
    <Card className="border border-border/60 bg-card">
      <CardHeader className="space-y-1">
        <CardTitle className="text-base">User Rechte</CardTitle>

        <div className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{userEmail}</span>
          <span className="mx-2">•</span>
          Abteilung: <span className="font-medium">{normalizedGroup}</span>
        </div>

        <div className="text-xs text-muted-foreground">
          Kein Override gesetzt = Abteilungsstandard gilt.
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-sm text-muted-foreground">Lade Rechte…</div>
        ) : (
          <div className="space-y-2">
            {rows.map((r) => (
              <div
                key={r.key}
                className="flex flex-col gap-2 rounded-md border border-border/60 bg-card px-3 py-2 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <div className="font-medium">{r.label}</div>
                  <div className="text-xs text-muted-foreground">
                    Standard: <strong>{levelLabel(r.base)}</strong> • {r.key}
                  </div>
                </div>

                <div className="w-full md:w-64">
                  <Select
                    value={r.selected}
                    onValueChange={(v) =>
                      setOverrideValue(r.key, v as OverrideValue)
                    }
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__default__">
                        Abteilungsstandard
                      </SelectItem>
                      <SelectItem value="none">Kein Zugriff</SelectItem>
                      <SelectItem value="view">Lesen</SelectItem>
                      <SelectItem value="write">Schreiben</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-border/50 pt-4">
          <Button
            variant="secondary"
            onClick={resetOverrides}
            disabled={saving || loading}
          >
            Alle Overrides löschen
          </Button>

          <Button onClick={save} disabled={saving || loading}>
            {saving ? "Speichern…" : "Speichern"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
