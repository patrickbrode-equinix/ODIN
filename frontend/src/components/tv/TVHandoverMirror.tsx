import { useEffect, useState } from "react";
import { HandoverList } from "../handover/HandoverList";
import type { HandoverItem } from "../handover/handover.types";

/* Use the public /api/tv/handover endpoint – no auth required */
async function loadHandoversPublic(): Promise<HandoverItem[]> {
  const res = await fetch("/api/tv/handover");
  if (!res.ok) throw new Error(`TV handover fetch failed: ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data)) return [];
  return data.map((item: any) => ({
    ...item,
    commitAt: item.commitAt ?? item.commit_at ?? null,
    status: item.status || "Offen",
    files: [],
  }));
}

export function TVHandoverMirror() {
  const [handovers, setHandovers] = useState<HandoverItem[]>([]);

  const reload = async () => {
    try {
      const data = await loadHandoversPublic();
      setHandovers(data.filter((h) => h.status !== "Erledigt"));
    } catch (e) {
      console.warn("[TVHandoverMirror] reload failed:", e);
    }
  };

  useEffect(() => {
    reload();
    const i = setInterval(reload, 15_000);
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

