import { create } from "zustand";
import { QueueApi } from "../api/queue";

interface TicketState {
    totalCount: number;
    loading: boolean;
    loadCounts: () => Promise<void>;
}

export const useTicketStore = create<TicketState>((set) => ({
    totalCount: 0,
    loading: false,

    loadCounts: async () => {
        set({ loading: true });
        try {
            const groups = await QueueApi.getGroups();
            // groups is Record<string, QueueGroup[]>
            // We need to sum up count of all groups across all queue types
            let total = 0;
            Object.values(groups).forEach(queueGroups => {
                queueGroups.forEach(g => {
                    total += g.count || 0;
                });
            });
            set({ totalCount: total, loading: false });
        } catch (err) {
            console.error("Failed to load ticket counts", err);
            set({ loading: false });
        }
    }
}));
