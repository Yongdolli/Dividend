import { SimulationConfig, SimulationYearlyData, Stock } from "./types";

/**
 * KRW exchange rates, refreshed from the server (/api/fx, /api/refresh-quotes).
 * The initial values are only fallbacks for the first paint before sync.
 */
const FX_STORAGE_KEY = "dividend_planner_fx";

let fxRates: Record<string, number> = { USD: 1400, JPY: 9.5, EUR: 1600, KRW: 1 };

// Restore last known rates so a page reload doesn't flash fallback values
try {
  const saved = localStorage.getItem(FX_STORAGE_KEY);
  if (saved) fxRates = { ...fxRates, ...JSON.parse(saved) };
} catch { /* ignore corrupted storage */ }

export function setFxRates(rates: Partial<Record<string, number>>) {
  for (const [cur, rate] of Object.entries(rates)) {
    if (typeof rate === "number" && rate > 0) fxRates[cur] = rate;
  }
  try { localStorage.setItem(FX_STORAGE_KEY, JSON.stringify(fxRates)); } catch { /* ignore */ }
}

export function getFxRate(currency: string): number {
  return fxRates[currency] ?? 1;
}

/** Convert a price in any supported currency to KRW */
export function toKRW(value: number, currency: string): number {
  return value * getFxRate(currency);
}

/**
 * Dividend withholding tax by listing currency:
 * Korean stocks 15.4% (배당소득세), US stocks 15% (원천징수).
 */
export function taxRateForCurrency(currency: string): number {
  return currency === "KRW" ? 0.154 : 0.15;
}

/**
 * Helper to format currency in Korean Won (KRW) or USD nicely
 */
export function formatCurrency(value: number, currency: string = "KRW"): string {
  if (currency === "USD") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0
    }).format(value);
  }

  // Custom format for Korean Won to include '억' and '만'
  if (value >= 100000000) {
    const eok = Math.floor(value / 100000000);
    const man = Math.floor((value % 100000000) / 10000);
    if (man === 0) {
      return `${eok}억원`;
    }
    return `${eok}억 ${man.toLocaleString("ko-KR")}만원`;
  } else if (value >= 10000) {
    return `${Math.floor(value / 10000).toLocaleString("ko-KR")}만원`;
  }

  return `${Math.floor(value).toLocaleString("ko-KR")}원`;
}

/**
 * Calculates a detailed year-by-year dividend reinvestment simulation
 */
export function calculateCompounding(
  config: SimulationConfig,
  portfolioYield: number,
  portfolioDividendGrowth: number,
  portfolioPriceGrowth: number
): SimulationYearlyData[] {
  const yearlyData: SimulationYearlyData[] = [];

  let currentPortfolioValue = config.initialCapital;
  let totalContributions = config.initialCapital;
  let currentMonthlyContribution = config.monthlyContribution;
  let cumulativeDividendsReceived = 0;
  let cumulativeDividendsReinvested = 0;

  // Push Year 0
  yearlyData.push({
    year: 0,
    portfolioValue: currentPortfolioValue,
    totalContributions: totalContributions,
    annualDividends: currentPortfolioValue * portfolioYield,
    monthlyDividends: (currentPortfolioValue * portfolioYield) / 12,
    totalDividendsReceived: 0,
    cumulativeDividendsReinvested: 0
  });

  const months = config.years * 12;

  let annualDividendsThisYear = 0;

  for (let m = 1; m <= months; m++) {
    // 1. Calculate dividend for this month based on the beginning value
    const monthlyYield = portfolioYield / 12;
    const monthlyDividendGross = currentPortfolioValue * monthlyYield;
    const monthlyDividendNet = monthlyDividendGross * (1 - config.dividendTaxRate);

    annualDividendsThisYear += monthlyDividendGross;
    cumulativeDividendsReceived += monthlyDividendNet;

    // 2. Reinvestment action
    let amountToReinvest = 0;
    if (config.reinvestmentStrategy === "DRIP") {
      amountToReinvest = monthlyDividendNet;
    } else if (config.reinvestmentStrategy === "Manual") {
      amountToReinvest = monthlyDividendNet * config.reinvestRate;
    }
    cumulativeDividendsReinvested += amountToReinvest;

    // 3. Asset growth (price appreciation)
    const monthlyPriceGrowth = portfolioPriceGrowth / 12;
    const capitalGrowth = currentPortfolioValue * monthlyPriceGrowth;

    // 4. Update portfolio value
    currentPortfolioValue += currentMonthlyContribution + amountToReinvest + capitalGrowth;
    totalContributions += currentMonthlyContribution;

    // At the end of every 12 months (each year)
    if (m % 12 === 0) {
      const year = m / 12;

      yearlyData.push({
        year,
        portfolioValue: Math.round(currentPortfolioValue),
        totalContributions: Math.round(totalContributions),
        annualDividends: Math.round(annualDividendsThisYear),
        monthlyDividends: Math.round(annualDividendsThisYear / 12),
        totalDividendsReceived: Math.round(cumulativeDividendsReceived),
        cumulativeDividendsReinvested: Math.round(cumulativeDividendsReinvested)
      });

      // Update variables for the next year.
      // The portfolio value already compounds by price growth, so the yield
      // (dividend ÷ price) must grow by dividend growth RELATIVE to price
      // growth — multiplying by (1 + divGrowth) alone double-counts and
      // wildly overstates long-horizon dividends.
      portfolioYield = portfolioYield * (1 + portfolioDividendGrowth) / (1 + portfolioPriceGrowth);
      // Gained contribution increase
      currentMonthlyContribution = currentMonthlyContribution * (1 + config.contributionGrowthRate);

      // Reset annual counter
      annualDividendsThisYear = 0;
    }
  }

  return yearlyData;
}

/**
 * Returns portfolio aggregated metrics
 */
export function calculatePortfolioMetrics(stocks: Stock[]) {
  let totalValueKRW = 0;
  let totalCostKRW = 0;
  let totalAnnualDividendKRW = 0;
  let totalAnnualDividendTaxKRW = 0;

  stocks.forEach(stock => {
    const stockValueKRW = stock.sharesOwned * toKRW(stock.currentPrice, stock.currency);
    totalValueKRW += stockValueKRW;
    // 평단가 미입력 종목은 현재가 매수로 간주 (손익 0)
    const costPerShare = stock.purchasePrice && stock.purchasePrice > 0 ? stock.purchasePrice : stock.currentPrice;
    totalCostKRW += stock.sharesOwned * toKRW(costPerShare, stock.currency);

    const stockAnnualDividendKRW = stockValueKRW * stock.dividendYield;
    totalAnnualDividendKRW += stockAnnualDividendKRW;
    totalAnnualDividendTaxKRW += stockAnnualDividendKRW * taxRateForCurrency(stock.currency);
  });

  const weightedYield = totalValueKRW > 0 ? totalAnnualDividendKRW / totalValueKRW : 0;
  const totalGainKRW = totalValueKRW - totalCostKRW;
  const totalGainPct = totalCostKRW > 0 ? totalGainKRW / totalCostKRW : 0;
  // 실측 Yield on Cost: 연간 배당금 ÷ 실제 매수원금
  const weightedYieldOnCost = totalCostKRW > 0 ? totalAnnualDividendKRW / totalCostKRW : 0;
  // Dividend-weighted effective withholding tax rate (KR 15.4%, US 15%)
  const weightedTaxRate = totalAnnualDividendKRW > 0
    ? totalAnnualDividendTaxKRW / totalAnnualDividendKRW
    : 0.154;

  // Weighted Dividend Growth Rate
  let totalWeight = 0;
  let weightedGrowthRate = 0;

  stocks.forEach(stock => {
    const stockValueKRW = stock.sharesOwned * toKRW(stock.currentPrice, stock.currency);
    if (totalValueKRW > 0) {
      const weight = stockValueKRW / totalValueKRW;
      weightedGrowthRate += weight * stock.dividendGrowthRate;
      totalWeight += weight;
    }
  });

  return {
    totalValueKRW,
    totalCostKRW,
    totalGainKRW,
    totalGainPct,
    totalAnnualDividendKRW,
    weightedYield,
    weightedYieldOnCost,
    weightedTaxRate,
    weightedGrowthRate: totalWeight > 0 ? weightedGrowthRate : 0
  };
}

/**
 * 목표 역산: N년 뒤 세후 월배당 목표를 달성하는 데 필요한 월 적립액을
 * 기존 복리 시뮬레이션을 이진 탐색으로 돌려 찾는다. 도달 불가능하면 null.
 */
export function solveRequiredMonthlyContribution(
  config: SimulationConfig,
  portfolioYield: number,
  portfolioDividendGrowth: number,
  portfolioPriceGrowth: number,
  targetNetMonthly: number,
  years: number
): number | null {
  const netMonthlyAt = (monthly: number): number => {
    const sim = calculateCompounding(
      { ...config, monthlyContribution: monthly, years },
      portfolioYield, portfolioDividendGrowth, portfolioPriceGrowth
    );
    const last = sim[sim.length - 1];
    return (last.annualDividends * (1 - config.dividendTaxRate)) / 12;
  };

  let lo = 0;
  let hi = 50_000_000; // 월 5천만원까지 탐색
  if (netMonthlyAt(hi) < targetNetMonthly) return null;
  if (netMonthlyAt(lo) >= targetNetMonthly) return 0;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (netMonthlyAt(mid) >= targetNetMonthly) hi = mid;
    else lo = mid;
  }
  return Math.ceil(hi / 10000) * 10000; // 만원 단위 올림
}

export interface RetirementYearData {
  year: number;             // 은퇴 후 경과 연수
  portfolioValue: number;
  netMonthlyDividend: number;
  realNetMonthlyDividend: number; // 물가 반영 실질 구매력
}

/**
 * 인출기 시뮬레이션: 적립을 멈추고 배당을 전액 생활비로 쓰는 기간.
 * 자산은 주가상승률로, 수익률은 배당성장률/주가상승률의 상대비로 변화.
 */
export function simulateRetirementPhase(
  startValue: number,
  startYield: number,
  dividendGrowth: number,
  priceGrowth: number,
  taxRate: number,
  years: number,
  inflation: number = 0.02
): RetirementYearData[] {
  const out: RetirementYearData[] = [];
  let value = startValue;
  let yieldNow = startYield;
  for (let y = 0; y <= years; y++) {
    const netMonthly = (value * yieldNow * (1 - taxRate)) / 12;
    out.push({
      year: y,
      portfolioValue: Math.round(value),
      netMonthlyDividend: Math.round(netMonthly),
      realNetMonthlyDividend: Math.round(netMonthly / Math.pow(1 + inflation, y))
    });
    value = value * (1 + priceGrowth);
    yieldNow = yieldNow * (1 + dividendGrowth) / (1 + priceGrowth);
  }
  return out;
}

/**
 * Calculate the monthly payout calendar for a list of stocks.
 * Uses each stock's real ex-dividend months when available (payoutMonths,
 * synced from the market data API); falls back to typical schedules.
 */
export function calculatePayoutCalendar(stocks: Stock[]): number[] {
  // Array of 12 months, initialized to 0
  const calendar = Array(12).fill(0);

  stocks.forEach(stock => {
    const stockValueKRW = stock.sharesOwned * toKRW(stock.currentPrice, stock.currency);
    const annualDividend = stockValueKRW * stock.dividendYield;

    if (stock.payoutMonths && stock.payoutMonths.length > 0) {
      const perPayout = annualDividend / stock.payoutMonths.length;
      stock.payoutMonths.forEach(m => {
        if (m >= 0 && m < 12) calendar[m] += perPayout;
      });
      return;
    }

    if (stock.payoutFrequency === "Monthly") {
      for (let i = 0; i < 12; i++) {
        calendar[i] += annualDividend / 12;
      }
    } else if (stock.payoutFrequency === "Quarterly") {
      // Typical US quarterly schedule: Mar/Jun/Sep/Dec
      for (const monthIndex of [2, 5, 8, 11]) {
        calendar[monthIndex] += annualDividend / 4;
      }
    } else if (stock.payoutFrequency === "Semi-Annually") {
      // 2 times a year, e.g., Jun & Dec (months 5 and 11)
      calendar[5] += annualDividend / 2;
      calendar[11] += annualDividend / 2;
    } else {
      // Annually, e.g., Dec (month 11)
      calendar[11] += annualDividend;
    }
  });

  return calendar.map(val => Math.round(val));
}
