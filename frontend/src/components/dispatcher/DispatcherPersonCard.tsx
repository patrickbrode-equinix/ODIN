/* ------------------------------------------------ */
/* DISPATCHER – PERSON CARD                         */
/* ------------------------------------------------ */

import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import { DispatcherEmployee, ShiftCode } from "./dispatcher.types";
import {
  Sun,
  Sunset,
  Moon,
  Ban,
} from "lucide-react";

/* ------------------------------------------------ */
/* ROLE LABELS                                      */
/* ------------------------------------------------ */

const ROLE_LABELS: Record<string, string> = {
  dispatcher: "Dispatcher",
  crossconnect: "Crossconnect",
  smarthands: "Smart Hands",
  project: "Projekt",
};

/* ------------------------------------------------ */
/* SHIFT ICONS + COLORS                             */
/* ------------------------------------------------ */

const SHIFT_META: Record<
  ShiftCode,
  { icon: React.ElementType; className: string }
> = {
  F: { icon: Sun, className: "text-orange-400" },
  S: { icon: Sunset, className: "text-yellow-400" },
  N: { icon: Moon, className: "text-blue-400" },
  ABW: { icon: Ban, className: "text-muted-foreground" },
};

/* ------------------------------------------------ */
/* COMPONENT                                        */
/* ------------------------------------------------ */

type Props = {
  employee: DispatcherEmployee;
  onSelect: (employee: DispatcherEmployee) => void;
};

export function DispatcherPersonCard({ employee, onSelect }: Props) {
  const meta = SHIFT_META[employee.shift];
  const ShiftIcon = meta.icon;

  return (
    <Card
  onClick={() => onSelect(employee)}
  className="p-3 cursor-pointer hover:bg-accent/40 transition rounded-xl"
>
  <div className="flex items-center justify-between gap-4">
    {/* LEFT: Name */}
    <div className="font-semibold whitespace-nowrap">
      {employee.name}
    </div>

    {/* RIGHT: Roles (left) + Icon (right) */}
    <div className="flex items-center gap-3">
      {employee.roles.length > 0 && (
        <div className="flex flex-wrap gap-1 justify-end">
          {employee.roles.map((role) => (
            <Badge key={role} variant="secondary">
              {ROLE_LABELS[role] ?? role}
            </Badge>
          ))}
        </div>
      )}

      {/* Shift Icon – ALWAYS LAST */}
      <ShiftIcon className={`w-5 h-5 shrink-0 ${meta.className}`} />
    </div>
  </div>
</Card>


  );
}
