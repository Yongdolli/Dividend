export interface Stock {
  id: string;
  ticker: string;
  name: string;
  currentPrice: number;
  currency: string;
  dividendYield: number;
  payoutRatio: number;
  dividendGrowthRate: number;
  payoutFrequency: 'Monthly' | 'Quarterly' | 'Semi-Annually' | 'Annually';
  growthStreak: number;
  safetyScore: number;
  safetyReason: string;
  analysis: string;
  pros: string[];
  cons: string[];
  sharesOwned: number;
  /** 주당 매수 평단가 (종목 통화 기준). 미입력 시 현재가로 간주 */
  purchasePrice?: number;
  historicalDividends?: { year: string; amount: number }[];
  cagrBreakdown?: { period: string; rate: number }[];
  /** Real ex-dividend months (0-11) from the last 12 months of market data */
  payoutMonths?: number[];
  /** GICS 섹터 (ETF/펀드는 null) — 시세 동기화 시 갱신 */
  sector?: string | null;
  /** EQUITY | ETF | MUTUALFUND 등 */
  quoteType?: string | null;
  /** 다음(또는 최근 공시된) 배당락일 YYYY-MM-DD */
  nextExDividendDate?: string | null;
  /** 배당 지급(예정)일 YYYY-MM-DD */
  nextDividendDate?: string | null;
}

export interface SimulationConfig {
  initialCapital: number;
  monthlyContribution: number;
  contributionGrowthRate: number;
  years: number;
  reinvestmentStrategy: 'DRIP' | 'Manual' | 'None';
  reinvestRate: number; // For Manual strategy, e.g., 0.50 for 50%
  dividendTaxRate: number; // e.g., 0.154 for 15.4% Korean dividend tax
  stockPriceGrowthRate: number; // e.g., 0.04 for 4% price appreciation
}

export interface SimulationYearlyData {
  year: number;
  portfolioValue: number;
  totalContributions: number;
  annualDividends: number;
  monthlyDividends: number;
  totalDividendsReceived: number;
  cumulativeDividendsReinvested: number;
}
