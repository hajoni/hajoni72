export interface StockPick {
  ticker: string;
  name: string;
  target: string;
  reason: string;
  sell: string;
}

export interface GeoRisk {
  level: string;
  title: string;
  body: string;
}

export interface BriefingSource {
  title: string;
  uri: string;
}

export interface IndexPoint {
  val: number;
  chg: number | null;
  pct: number | null;
}

export interface Briefing {
  fetchedAt: string; // ISO string, 실제 응답을 받은 시각
  krSummary: string[];
  usSummary: string[];
  krTop5: StockPick[];
  usTop5: StockPick[];
  geopolitics: GeoRisk[];
  policyNotes: string[];
  indices: Record<string, IndexPoint>;
  sources: BriefingSource[];
}
