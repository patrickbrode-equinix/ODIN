/* ------------------------------------------------ */
/* TICKET HANDOVER – API CLIENT                     */
/* ------------------------------------------------ */

import { api } from "./api";

export interface TicketHandover {
    id: number;
    ticket_id: string;
    type: "Workload" | "Terminiert" | "Other Teams";
    created_at: string;
    created_by: string | null;
    status: string;
}

export async function createTicketHandover(
    ticket_id: string,
    type: TicketHandover["type"],
    created_by?: string
): Promise<TicketHandover> {
    const { data } = await api.post("/ticket-handover", {
        ticket_id,
        type,
        created_by: created_by ?? null,
    });
    return data;
}

export async function getTicketHandovers(): Promise<TicketHandover[]> {
    const { data } = await api.get("/ticket-handover");
    return data;
}
