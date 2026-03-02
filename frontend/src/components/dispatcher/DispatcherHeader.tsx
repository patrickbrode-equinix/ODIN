/* ------------------------------------------------ */
/* DISPATCHER HEADER                                */
/* WEEK / DATE RANGE (ISO WEEK)                     */
/* ------------------------------------------------ */

import {
  addWeeks,
  subWeeks,
  startOfISOWeek,
  endOfISOWeek,
  getISOWeek,
  format,
} from "date-fns";

import { Button } from "../ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

/* ------------------------------------------------ */
/* TYPES                                            */
/* ------------------------------------------------ */

type Props = {
  weekDate: Date;
  onPrevWeek: () => void;
  onNextWeek: () => void;
};

/* ------------------------------------------------ */
/* COMPONENT                                        */
/* ------------------------------------------------ */

export function DispatcherHeader({
  weekDate,
  onPrevWeek,
  onNextWeek,
}: Props) {
  const weekNumber = getISOWeek(weekDate);
  const from = startOfISOWeek(weekDate);
  const to = endOfISOWeek(weekDate);

  return (
    <div className="flex items-center justify-between p-4 bg-card border rounded-2xl">
      <div>
        <h2 className="text-xl font-bold">ODIN</h2>
        <p className="text-muted-foreground">
          KW {weekNumber} |{" "}
          {format(from, "dd.MM.yyyy")} –{" "}
          {format(to, "dd.MM.yyyy")}
        </p>
      </div>

      <div className="flex gap-2">
        <Button variant="outline" size="icon" onClick={onPrevWeek}>
          <ChevronLeft className="w-4 h-4" />
        </Button>

        <Button variant="outline" size="icon" onClick={onNextWeek}>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
