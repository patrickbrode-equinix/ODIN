/* ------------------------------------------------ */
/* ADD USER MODAL – CREATE USER                     */
/* ------------------------------------------------ */

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
import { useLanguage } from "../../context/LanguageContext";

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

const EMPTY_FORM = {
  firstName: "",
  lastName: "",
  email: "",
  initialPassword: "",
  ibx: "",
  department: "",
  role: "user",
};

const FALLBACK_DEPARTMENT = { value: "other", label: "Other Team" };

/* ------------------------------------------------ */
/* COMPONENT                                        */
/* ------------------------------------------------ */

export function AddUserModal({ open, onClose, onCreated }: AddUserModalProps) {
  const { t } = useLanguage();
  const copy = {
    createFailed: t("addUser.createFailed"),
    title: t("addUser.title"),
    subtitle: t("addUser.subtitle"),
    note: t("addUser.note"),
    firstName: t("addUser.firstName"),
    lastName: t("addUser.lastName"),
    email: t("addUser.email"),
    initialPassword: t("addUser.initialPassword"),
    initialPasswordPlaceholder: t("addUser.passwordPlaceholder"),
    location: t("addUser.location"),
    locationPlaceholder: t("addUser.locationPlaceholder"),
    department: t("addUser.department"),
    departmentPlaceholder: t("addUser.departmentPlaceholder"),
    role: t("addUser.role"),
    cancel: t("common.cancel"),
    saving: t("common.saving"),
    submit: t("addUser.submit"),
  };
  /* ------------------------------------------------ */
  /* STATE                                           */
  /* ------------------------------------------------ */

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [deptOptions, setDeptOptions] = useState<Option[]>([]);

  const [form, setForm] = useState(EMPTY_FORM);

  const canSubmit = useMemo(() => {
    return Boolean(
      form.firstName.trim() &&
      form.lastName.trim() &&
      form.email.trim() &&
      form.initialPassword.trim() &&
      form.ibx.trim() &&
      form.department.trim()
    );
  }, [form]);

  useEffect(() => {
    if (open) {
      setError("");
      setLoading(false);
      return;
    }

    setError("");
    setLoading(false);
    setDeptOptions([]);
    setForm(EMPTY_FORM);
  }, [open]);

  /* ------------------------------------------------ */
  /* LOAD DEPARTMENTS                                */
  /* ------------------------------------------------ */

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    async function loadDepartments() {
      try {
        const res = await api.get<GroupRow[]>("/admin/groups");
        const groups = Array.isArray(res.data) ? res.data : [];

        if (cancelled) return;

        const opts = groups
          .filter((g) => g.key)
          .map((g) => ({
            value: g.key,
            label: g.label || g.key,
          }));

        const nextOptions = opts.length ? opts : [FALLBACK_DEPARTMENT];

        setDeptOptions(nextOptions);

        setForm((prev) =>
          prev.department
            ? prev
            : { ...prev, department: nextOptions[0].value }
        );
      } catch {
        if (!cancelled) {
          setDeptOptions([FALLBACK_DEPARTMENT]);
          setForm((prev) =>
            prev.department
              ? prev
              : { ...prev, department: FALLBACK_DEPARTMENT.value }
          );
        }
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
      await api.post("/admin/users", {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        initialPassword: form.initialPassword,
        ibx: form.ibx,
        group: form.department.trim(),
        isAdmin: form.role === "admin",
      });

      onClose();
      onCreated?.();
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
          copy.createFailed
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
            {copy.title}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {copy.subtitle}
          </p>
          <p className="text-xs text-muted-foreground">
            {copy.note}
          </p>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* NAME */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{copy.firstName}</Label>
                <Input
                  value={form.firstName}
                  onChange={(e) =>
                    setForm({ ...form, firstName: e.target.value })
                  }
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label>{copy.lastName}</Label>
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
              <Label>{copy.email}</Label>
              <Input
                value={form.email}
                onChange={(e) =>
                  setForm({ ...form, email: e.target.value })
                }
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label>{copy.initialPassword}</Label>
              <Input
                type="password"
                value={form.initialPassword}
                onChange={(e) =>
                  setForm({ ...form, initialPassword: e.target.value })
                }
                disabled={loading}
                placeholder={copy.initialPasswordPlaceholder}
              />
            </div>

            {/* IBX */}
            <div className="space-y-2">
              <Label>{copy.location}</Label>
              <Select
                value={form.ibx}
                onValueChange={(v) =>
                  setForm({ ...form, ibx: v })
                }
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
                value={form.department}
                onValueChange={(v) =>
                  setForm({ ...form, department: v })
                }
                disabled={loading}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder={copy.departmentPlaceholder} />
                </SelectTrigger>
                <SelectContent>
                  {(deptOptions.length ? deptOptions : [FALLBACK_DEPARTMENT]).map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{copy.role}</Label>
              <Select
                value={form.role}
                onValueChange={(v) =>
                  setForm({ ...form, role: v })
                }
                disabled={loading}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
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
                {copy.cancel}
              </Button>

              <Button
                type="submit"
                disabled={loading || !canSubmit}
              >
                {loading ? copy.saving : copy.submit}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
