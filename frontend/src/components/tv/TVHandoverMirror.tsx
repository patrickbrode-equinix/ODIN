import { useEffect, useState } from "react";
import { HandoverList } from "../handover/HandoverList";
import type { HandoverItem } from "../handover/handover.types";
import { loadHandovers } from "../handover/handover.api";

export function TVHandoverMirror() {
  const [handovers, setHandovers] = useState<HandoverItem[]>([]);
  const [openDropdown, setOpenDropdown] = useState<number | null>(null);

  const reload = async () => {
    const data = await loadHandovers();
    setHandovers(data.filter(h => h.status !== "Erledigt"));
  };

  useEffect(() => {
    reload();
    const i = setInterval(reload, 15000);
    return () => clearInterval(i);
  }, []);

  return (
    <HandoverList
      handovers={handovers}
      showCompleted={false}
      currentUser=""
      onTakeOver={() => { }}
      onComplete={() => { }}
      onDelete={() => { }}
      onRestore={() => { }}
    />
  );
}
