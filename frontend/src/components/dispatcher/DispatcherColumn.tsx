/* ------------------------------------------------ */
/* DISPATCHER – SHIFT COLUMN                        */
/* ------------------------------------------------ */

import { Card, CardHeader, CardContent } from "../ui/card";
import { DispatcherEmployee, ShiftCode } from "./dispatcher.types";
import { DispatcherPersonCard } from "./DispatcherPersonCard";

/* ------------------------------------------------ */
/* SHIFT LABELS                                     */
/* ------------------------------------------------ */

const SHIFT_LABELS: Record<ShiftCode, string> = {
  F: "Frühschicht",
  S: "Spätschicht",
  N: "Nachtschicht",
  ABW: "Abwesend / Freischicht",
};

/* ------------------------------------------------ */
/* COMPONENT                                        */
/* ------------------------------------------------ */

type Props = {
  shift: ShiftCode;
  employees: DispatcherEmployee[];
  onSelect: (employee: DispatcherEmployee) => void;
};

export function DispatcherColumn({
  shift,
  employees,
  onSelect,
}: Props) {
  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-2">
        <div className="font-bold">
          {SHIFT_LABELS[shift]} ({employees.length})
        </div>
      </CardHeader>

      <CardContent className="space-y-2">
        {employees.map((e) => (
          <DispatcherPersonCard
            key={e.name}
            employee={e}
            onSelect={onSelect}
          />
        ))}
      </CardContent>
    </Card>
  );
}
