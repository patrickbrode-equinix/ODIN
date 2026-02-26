import { api } from "./api";

export interface ActivityLogEntry {
    id: number;
    ts: string;
    actor: string;
    action_type: string;
    module: string;
    entity_type?: string;
    entity_id?: string;
    correlation_id?: string;
    payload?: any;
}

export async function getActivityLog(params: {
    limit?: number;
    offset?: number;
    module?: string;
    action?: string;
    actor?: string;
    start?: string;
    end?: string;
}) {
    const res = await api.get<ActivityLogEntry[]>("/activity", { params });
    return res.data;
}

export async function getActivityStats() {
    const res = await api.get<{ module: string, count: string }[]>("/activity/stats");
    return res.data;
}
