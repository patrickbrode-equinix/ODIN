// Queue API Client — uses the shared axios instance (JWT auto-injected via interceptor)
import { api, asArray, asObject } from "./api";

export interface QueueGroup {
    name: string;
    count: number;
}

export interface Ticket {
    id: number;
    external_id: string;
    queue_type: string;
    group_key: string;
    status: string;
    subtype: string;
    owner: string;
    sched_start: string;
    commit_date: string;
    active: boolean;
    [key: string]: any;
}

export interface QueueStats {
    expired: number;
    critical12h: number;
    critical24h: number;
    total: number;
}

export interface GroupSummary {
    group: string;
    count: number;
    overdue: number;
    critical12h: number;
}

export const QueueApi = {
    getGroups: async (): Promise<Record<string, QueueGroup[]>> => {
        const res = await api.get("/queue/groups");
        return asObject(res.data, "QueueApi.getGroups") as Record<string, QueueGroup[]>;
    },

    getTickets: async (queueType?: string): Promise<Ticket[]> => {
        const res = await api.get("/queue/tickets", {
            params: queueType ? { queueType } : undefined,
        });
        return asArray(res.data, "QueueApi.getTickets");
    },

    getDueToday: async (): Promise<Ticket[]> => {
        const res = await api.get("/queue/tickets");
        return asArray(res.data, "QueueApi.getDueToday");
    },

    getMeta: async () => {
        const res = await api.get("/queue/tickets");
        const tickets = asArray(res.data, "QueueApi.getMeta");
        return { total: tickets.length, lastUpdate: new Date().toISOString() };
    },

    getStats: async (): Promise<QueueStats> => {
        return { expired: 0, critical12h: 0, critical24h: 0, total: 0 };
    },

    getHealth: async () => {
        // /health is at the root of /api, not under /queue
        const res = await api.get("/health");
        return res.data;
    },
};

export const queueApi = QueueApi;
