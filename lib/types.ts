export type AuctionSource = "copart" | "iaai";

export type AuctionVehicle = {
  id: string;
  source: AuctionSource;
  lotNumber?: string;
  stockNumber?: string;
  vin?: string;
  year?: number;
  make?: string;
  model?: string;
  trim?: string;
  title: string;
  odometer?: string;
  damage?: string;
  location?: string;
  saleDate?: string;
  currentBid?: string;
  buyNowPrice?: string;
  url: string;
  imageUrl?: string;
  raw?: unknown;
};

export type SourceCheckSummary = {
  source: AuctionSource;
  enabled: boolean;
  ok: boolean;
  found: number;
  matched: number;
  newFound: number;
  error?: string;
};

export type CronCheckSummary = {
  ok: boolean;
  checkedAt: string;
  totalFound: number;
  newFound: number;
  sources: SourceCheckSummary[];
};

export type DashboardStats = {
  seenCount: number;
  lastCheck: CronCheckSummary | null;
};
