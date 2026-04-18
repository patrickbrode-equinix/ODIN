import { api } from "./api";

export type MarketQuote = {
  symbol: string;
  available: boolean;
  currency: string | null;
  marketState: string | null;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  asOf: string | null;
  source: string | null;
  cached: boolean;
  stale: boolean;
};

export async function fetchEqixQuote() {
  const { data } = await api.get<MarketQuote>("/market/eqix");
  return data;
}