/* ------------------------------------------------ */
/* DISPATCHER – SIDE PANEL                          */
/* ------------------------------------------------ */

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "../ui/sheet";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";

import { DispatcherEmployee, ShiftCode, RoleCode } from "./dispatcher.types";

/* ------------------------------------------------ */
/* CONSTANTS                                        */
/* ------------------------------------------------ */

const SHIFT_LABELS: Record<ShiftCode, string> = {
  F: "Frühschicht",
  S: "Spätschicht",
  N: "Nachtschicht",
  ABW: "Abwesend / Freischicht",
};

const ROLE_LABELS: Record<RoleCode, string> = {
  dispatcher: "Dispatcher",
  crossconnect: "Crossconnect",
  smarthands: "Smart Hands",
  project: "Projekt",
};

/* ------------------------------------------------ */
/* COMPONENT                                        */
/* ------------------------------------------------ */

type Props = {
  open: boolean;
  employee: DispatcherEmployee | null;
  onClose: () => void;
  onSave: (employee: DispatcherEmployee) => void;
};

export function DispatcherSidePanel({
  open,
  employee,
  onClose,
  onSave,
}: Props) {
  if (!employee) return null;

  const updateShift = (shift: ShiftCode) => {
    onSave({ ...employee, shift });
  };

  const toggleRole = (role: RoleCode) => {
    const hasRole = employee.roles.includes(role);
    onSave({
      ...employee,
      roles: hasRole
        ? employee.roles.filter((r) => r !== role)
        : [...employee.roles, role],
    });
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-[360px]">
        <SheetHeader>
          <SheetTitle>{employee.name}</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* SHIFT */}
          <div className="space-y-2">
            <Label>Schicht</Label>
            <Select value={employee.shift} onValueChange={updateShift}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(SHIFT_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* ROLES */}
          <div className="space-y-2">
            <Label>Rollen</Label>

            <div className="space-y-2">
              {(Object.keys(ROLE_LABELS) as RoleCode[]).map((role) => (
                <div key={role} className="flex items-center gap-2">
                  <Checkbox
                    checked={employee.roles.includes(role)}
                    onCheckedChange={() => toggleRole(role)}
                  />
                  <span>{ROLE_LABELS[role]}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ACTIONS */}
          <div className="pt-4 border-t">
            <Button variant="outline" onClick={onClose} className="w-full">
              Schließen
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
