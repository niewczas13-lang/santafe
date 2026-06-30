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
  exteriorColor?: string;
  interiorColor?: string;
  engine?: string;
  runStatus?: VehicleRunStatus;
  damage?: string;
  location?: string;
  saleDate?: string;
  currentBid?: string;
  buyNowPrice?: string;
  url: string;
  imageUrl?: string;
  raw?: unknown;
};

export type VehicleRunStatus =
  | "run_and_drive"
  | "starts"
  | "stationary"
  | "unknown";

export type AuctionFilters = {
  exteriorColor?: string;
  interiorColor?: string;
  excludedInteriorColor?: string;
  engine?: string;
  maxEngineLiters?: number;
  requireCalligraphy: boolean;
  runStatuses: VehicleRunStatus[];
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
