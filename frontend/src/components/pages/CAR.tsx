/* ------------------------------------------------ */
/* CAR – PLATZHALTER-SEITE                          */
/* Details folgen – wird später mit Fachlogik gefüllt */
/* ------------------------------------------------ */

import { Car } from "lucide-react";

export default function CARPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
      <div className="flex items-center gap-3">
        <Car className="w-10 h-10 text-indigo-400" />
        <h1 className="text-3xl font-bold tracking-tight">CAR</h1>
      </div>
      <p className="text-muted-foreground text-center max-w-md">
        Diese Seite befindet sich im Aufbau. Details zur Fachlogik folgen in
        einem späteren Release.
      </p>
      <div className="text-xs text-muted-foreground/50 font-mono">
        Platzhalter – v1.0.0
      </div>
    </div>
  );
}
