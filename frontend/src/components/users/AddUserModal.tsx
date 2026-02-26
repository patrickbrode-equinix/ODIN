/* ------------------------------------------------ */
/* ADD USER MODAL – CREATE USER (POLICY CLEAN)      */
/* ------------------------------------------------ */
/**
 * Regeln:
 * - Neue User bekommen KEINE Overrides
 * - Abteilungs-Policy greift automatisch
 * - Keine Rollen-Auswahl (RBAC only)
 * - Passwort wird serverseitig gesetzt
 */

import { useEffect, useMemo, useState } from "react";
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

import { IBX_OPTIONS } from "./userOptions";

/* ------------------------------------------------ */
/* TYPES                                            */
/* ------------------------------------------------ */

type AddUserModalProps = {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
};

type GroupRow = {
  key: string;
  label: string;
};

type Option = {
  value: string;
  label: string;
};

/* ------------------------------------------------ */
/* COMPONENT                                        */
/* ------------------------------------------------ */

export function AddUserModal({ open, onClose, onCreated }: AddUserModalProps) {
  /* ------------------------------------------------ */
  /* STATE                                           */
  /* ------------------------------------------------ */

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [deptOptions, setDeptOptions] = useState<Option[]>([]);

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    ibx: "",
    department: "",
  });

  const canSubmit = useMemo(() => {
    return (
      form.firstName.trim() &&
      form.lastName.trim() &&
      form.email.trim() &&
      form.ibx.trim() &&
      form.department.trim()
    );
  }, [form]);

  /* ------------------------------------------------ */
  /* LOAD DEPARTMENTS                                */
  /* ------------------------------------------------ */

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    async function loadDepartments() {
      try {
        const res = await api.get<GroupRow[]>("/groups");
        const groups = Array.isArray(res.data) ? res.data : [];

        if (cancelled) return;

        const opts = groups
          .filter((g) => g.key)
          .map((g) => ({
            value: g.key,
            label: g.label || g.key,
          }));

        setDeptOptions(opts);

        if (!form.department && opts.length > 0) {
          setForm((prev) => ({ ...prev, department: opts[0].value }));
        }
      } catch {
        if (!cancelled) setDeptOptions([]);
      }
    }

    loadDepartments();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  /* ------------------------------------------------ */
  /* SUBMIT                                          */
  /* ------------------------------------------------ */

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await api.post("/users", {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        ibx: form.ibx,
        group: form.department,
      });

      onClose();
      onCreated?.();
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
          "User konnte nicht angelegt werden"
      );
    } finally {
      setLoading(false);
    }
  };

  /* ------------------------------------------------ */
  /* RENDER                                          */
  /* ------------------------------------------------ */

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <Card className="w-full max-w-lg border border-border/50 bg-background/90 backdrop-blur-xl shadow-2xl">
        <CardHeader className="space-y-2">
          <CardTitle className="text-2xl font-bold">
            User anlegen
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Passwort wird automatisch serverseitig gesetzt
          </p>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* NAME */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Vorname</Label>
                <Input
                  value={form.firstName}
                  onChange={(e) =>
                    setForm({ ...form, firstName: e.target.value })
                  }
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label>Nachname</Label>
                <Input
                  value={form.lastName}
                  onChange={(e) =>
                    setForm({ ...form, lastName: e.target.value })
                  }
                  disabled={loading}
                />
              </div>
            </div>

            {/* EMAIL */}
            <div className="space-y-2">
              <Label>E-Mail</Label>
              <Input
                value={form.email}
                onChange={(e) =>
                  setForm({ ...form, email: e.target.value })
                }
                disabled={loading}
              />
            </div>

            {/* IBX */}
            <div className="space-y-2">
              <Label>Standort (IBX)</Label>
              <Select
                value={form.ibx}
                onValueChange={(v) =>
                  setForm({ ...form, ibx: v })
                }
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
                value={form.department}
                onValueChange={(v) =>
                  setForm({ ...form, department: v })
                }
                disabled={loading}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(deptOptions.length
                    ? deptOptions
                    : [{ value: "other", label: "Other Team" }]
                  ).map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="secondary"
                onClick={onClose}
                disabled={loading}
              >
                Abbrechen
              </Button>

              <Button
                type="submit"
                disabled={loading || !canSubmit}
              >
                {loading ? "Speichern…" : "User anlegen"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
