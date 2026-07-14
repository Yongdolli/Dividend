import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import YahooFinance from "yahoo-finance2";

dotenv.config();

const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

// ---------------------------------------------------------------------------
// In-memory caches (no disk cache: works on stateless hosts like Render/Cloud Run)
// ---------------------------------------------------------------------------
const SNAPSHOT_TTL_MS = 10 * 60 * 1000; // 10 minutes for quotes/dividends
const FX_TTL_MS = 60 * 60 * 1000;       // 1 hour for FX rates
const RECS_TTL_MS = 10 * 60 * 1000;     // 10 minutes for the recommendations board

const snapshotCache = new Map<string, { data: MarketSnapshot; fetchedAt: number }>();
let fxCache: { rates: FxRates; fetchedAt: number } | null = null;
let recsCache: { payload: any; fetchedAt: number } | null = null;

interface FxRates {
  USD: number; // KRW per 1 USD
  JPY: number; // KRW per 1 JPY
  EUR: number; // KRW per 1 EUR
}

interface DividendPoint { year: string; amount: number }

interface MarketSnapshot {
  symbol: string;          // Yahoo symbol (e.g. "088980.KS")
  displayTicker: string;   // User-facing ticker (e.g. "088980", "SCHD")
  name: string;
  currency: string;
  price: number;
  marketTime: string | null;
  dividendYield: number;       // trailing-12-month dividends / price
  ttmDividend: number;         // trailing-12-month dividend per share
  payoutRatio: number | null;  // null for ETFs/funds where it doesn't apply
  dividendGrowthRate: number;  // annual dividend CAGR (5y preferred)
  growthStreak: number;        // consecutive full years of dividend increases
  payoutFrequency: "Monthly" | "Quarterly" | "Semi-Annually" | "Annually";
  payoutMonths: number[];      // 0-11, months with ex-dividend dates in last 12m
  historicalDividends: DividendPoint[]; // last 5 full calendar years
  cagrBreakdown: { period: string; year: string; rate: number }[];
  fundamentals: {
    operatingMargin: number | null;
    debtToEquity: number | null;
    roe: number | null;
    revenueGrowthYoY: number | null;
    earningsGrowthYoY: number | null;
  };
}

// ---------------------------------------------------------------------------
// Symbol resolution: 6-digit KR codes, Korean names (via Naver autocomplete),
// plain tickers, and Yahoo text search as a fallback.
// ---------------------------------------------------------------------------
async function tryQuote(symbol: string) {
  try {
    const q = await yf.quote(symbol);
    if (q && typeof q.regularMarketPrice === "number") return q;
  } catch {
    // invalid symbol — caller tries the next candidate
  }
  return null;
}

async function naverResolveKoreanName(query: string): Promise<string | null> {
  try {
    const url = `https://ac.stock.naver.com/ac?q=${encodeURIComponent(query)}&target=stock`;
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!res.ok) return null;
    const json: any = await res.json();
    const item = (json.items ?? []).find(
      (i: any) => i.nationCode === "KOR" && /^\d{6}$/.test(i.code)
    );
    if (!item) return null;
    return `${item.code}${item.typeCode === "KOSDAQ" ? ".KQ" : ".KS"}`;
  } catch {
    return null;
  }
}

async function resolveSymbol(query: string, country?: string): Promise<string | null> {
  const raw = query.trim();
  if (!raw) return null;

  // 6-digit Korean stock code
  if (/^\d{6}$/.test(raw)) {
    for (const sym of [`${raw}.KS`, `${raw}.KQ`]) {
      if (await tryQuote(sym)) return sym;
    }
    return null;
  }

  // Korean company name → Naver autocomplete → code
  if (/[가-힣]/.test(raw)) {
    const sym = await naverResolveKoreanName(raw);
    if (sym && (await tryQuote(sym))) return sym;
    return null;
  }

  // 4-digit Japanese code
  if (country === "JPY" && /^\d{4}$/.test(raw)) {
    const sym = `${raw}.T`;
    if (await tryQuote(sym)) return sym;
  }

  // Plain ticker attempt (AAPL, SCHD, BRK-B, ...)
  const upper = raw.toUpperCase();
  if (/^[A-Z][A-Z0-9.\-]{0,9}$/.test(upper)) {
    if (await tryQuote(upper)) return upper;
  }

  // Yahoo text search fallback (works for English names)
  try {
    const result = await yf.search(raw);
    const quotes = (result.quotes ?? []).filter(
      (q: any) =>
        q.symbol && ["EQUITY", "ETF", "MUTUALFUND"].includes(q.quoteType)
    ) as any[];
    if (quotes.length === 0) return null;

    const byCountry = quotes.find((q: any) => {
      const s: string = q.symbol;
      if (country === "KRW") return s.endsWith(".KS") || s.endsWith(".KQ");
      if (country === "JPY") return s.endsWith(".T");
      if (country === "EUR") return /\.(DE|PA|AS|MI|MC|BR)$/.test(s);
      if (country === "USD") return !s.includes(".");
      return false;
    });
    return (byCountry ?? quotes[0]).symbol;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Dividend statistics from real dividend events
// ---------------------------------------------------------------------------
function computeDividendStats(
  events: { amount: number; date: Date | number }[],
  price: number
) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const lastFullYear = currentYear - 1;
  const oneYearAgo = now.getTime() - 365 * 24 * 3600 * 1000;

  const annualByYear = new Map<number, number>();
  const lastPaymentOfYear = new Map<number, { amount: number; time: number }>();
  const recent: { amount: number; date: Date }[] = [];

  for (const ev of events) {
    const d = ev.date instanceof Date ? ev.date : new Date(ev.date);
    const y = d.getFullYear();
    annualByYear.set(y, (annualByYear.get(y) ?? 0) + ev.amount);
    const last = lastPaymentOfYear.get(y);
    if (!last || d.getTime() > last.time) {
      lastPaymentOfYear.set(y, { amount: ev.amount, time: d.getTime() });
    }
    if (d.getTime() >= oneYearAgo) recent.push({ amount: ev.amount, date: d });
  }

  const ttmDividend = recent.reduce((acc, ev) => acc + ev.amount, 0);
  const dividendYield = price > 0 ? ttmDividend / price : 0;

  // Payout frequency & months, from actual ex-dividend dates in the last 12 months
  let payoutFrequency: MarketSnapshot["payoutFrequency"] = "Annually";
  if (recent.length >= 10) payoutFrequency = "Monthly";
  else if (recent.length >= 3) payoutFrequency = "Quarterly";
  else if (recent.length === 2) payoutFrequency = "Semi-Annually";
  // Monthly payers cover every month; ex-date drift can leave a gap month in
  // the raw 12m window, so normalize instead of showing a false zero month.
  const payoutMonths = payoutFrequency === "Monthly"
    ? [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
    : [...new Set(recent.map(ev => ev.date.getMonth()))].sort((a, b) => a - b);

  // Last 5 full calendar years of per-share dividends
  const historicalDividends: DividendPoint[] = [];
  for (let y = lastFullYear - 4; y <= lastFullYear; y++) {
    if (annualByYear.has(y)) {
      historicalDividends.push({
        year: String(y),
        amount: Math.round((annualByYear.get(y) ?? 0) * 10000) / 10000
      });
    }
  }

  // CAGR over 1/3/5/10 full years
  const cagr = (years: number): number | null => {
    const from = annualByYear.get(lastFullYear - years);
    const to = annualByYear.get(lastFullYear);
    if (!from || !to || from <= 0 || to <= 0) return null;
    return Math.pow(to / from, 1 / years) - 1;
  };
  const cagrBreakdown = ([1, 3, 5, 10] as const)
    .map(n => ({ n, rate: cagr(n) }))
    .filter(x => x.rate !== null)
    .map(x => ({
      period: `${x.n}년 CAGR`,
      year: `${x.n}년`,
      rate: Math.round((x.rate as number) * 10000) / 10000
    }));

  const dividendGrowthRate = cagr(5) ?? cagr(3) ?? cagr(1) ?? 0;

  // Consecutive years of dividend increases, counting back from the last full
  // year. A year counts if the annual sum OR the year-end payment rate rose —
  // the sum alone whipsaws for monthly payers whose ex-dates drift between
  // calendar years (11 vs 13 payments in a year).
  let growthStreak = 0;
  for (let y = lastFullYear; y > lastFullYear - 60; y--) {
    const curSum = annualByYear.get(y);
    const prevSum = annualByYear.get(y - 1);
    if (curSum === undefined || prevSum === undefined) break;
    const curPay = lastPaymentOfYear.get(y)?.amount ?? 0;
    const prevPay = lastPaymentOfYear.get(y - 1)?.amount ?? 0;
    if (curSum > prevSum * 1.0005 || curPay > prevPay * 1.0005) growthStreak++;
    else break;
  }

  return {
    ttmDividend: Math.round(ttmDividend * 10000) / 10000,
    dividendYield: Math.round(dividendYield * 10000) / 10000,
    dividendGrowthRate: Math.round(dividendGrowthRate * 10000) / 10000,
    growthStreak,
    payoutFrequency,
    payoutMonths,
    historicalDividends,
    cagrBreakdown
  };
}

// ---------------------------------------------------------------------------
// Full market snapshot for one symbol (quote + dividends + fundamentals)
// ---------------------------------------------------------------------------
async function getMarketSnapshot(symbol: string, force = false): Promise<MarketSnapshot> {
  const cached = snapshotCache.get(symbol);
  if (!force && cached && Date.now() - cached.fetchedAt < SNAPSHOT_TTL_MS) {
    return cached.data;
  }

  const quote = await yf.quote(symbol);
  if (!quote || typeof quote.regularMarketPrice !== "number") {
    throw new Error(`No quote data for ${symbol}`);
  }
  const price = quote.regularMarketPrice;

  let events: { amount: number; date: Date }[] = [];
  try {
    // NOTE: interval must be "1mo" or finer — coarser intervals silently drop
    // dividend events for monthly payers (e.g. Realty Income).
    const chart = await yf.chart(symbol, {
      period1: "1990-01-01",
      interval: "1mo",
      events: "div"
    });
    events = (chart.events?.dividends ?? []) as any[];
  } catch {
    // No dividend history available — treated as a non-payer below
  }

  const stats = computeDividendStats(events, price);

  // Fundamentals (stocks only; ETFs/funds usually have none — left as null)
  let payoutRatio: number | null = null;
  const fundamentals: MarketSnapshot["fundamentals"] = {
    operatingMargin: null,
    debtToEquity: null,
    roe: null,
    revenueGrowthYoY: null,
    earningsGrowthYoY: null
  };
  try {
    const summary = await yf.quoteSummary(symbol, {
      modules: ["summaryDetail", "financialData"]
    });
    const sd: any = summary.summaryDetail ?? {};
    const fd: any = summary.financialData ?? {};
    if (typeof sd.payoutRatio === "number" && sd.payoutRatio > 0 && sd.payoutRatio < 5) {
      payoutRatio = Math.round(sd.payoutRatio * 1000) / 1000;
    }
    if (typeof fd.operatingMargins === "number") fundamentals.operatingMargin = fd.operatingMargins;
    if (typeof fd.debtToEquity === "number") fundamentals.debtToEquity = Math.round(fd.debtToEquity) / 100;
    if (typeof fd.returnOnEquity === "number") fundamentals.roe = fd.returnOnEquity;
    if (typeof fd.revenueGrowth === "number") fundamentals.revenueGrowthYoY = fd.revenueGrowth;
    if (typeof fd.earningsGrowth === "number") fundamentals.earningsGrowthYoY = fd.earningsGrowth;
  } catch {
    // quoteSummary is optional enrichment
  }

  // Estimate payout ratio from EPS when summaryDetail doesn't provide one
  if (payoutRatio === null) {
    const eps = (quote as any).epsTrailingTwelveMonths;
    if (typeof eps === "number" && eps > 0 && stats.ttmDividend > 0) {
      payoutRatio = Math.round((stats.ttmDividend / eps) * 1000) / 1000;
    }
  }

  const marketTimeRaw = (quote as any).regularMarketTime;
  const marketTime = marketTimeRaw
    ? new Date(
        marketTimeRaw instanceof Date ? marketTimeRaw : marketTimeRaw * 1000
      ).toLocaleString("ko-KR", { hour12: false })
    : null;

  const snapshot: MarketSnapshot = {
    symbol,
    displayTicker: symbol.replace(/\.(KS|KQ)$/, ""),
    name: quote.longName || quote.shortName || symbol,
    currency: quote.currency || "USD",
    price,
    marketTime,
    payoutRatio,
    fundamentals,
    ...stats
  };

  snapshotCache.set(symbol, { data: snapshot, fetchedAt: Date.now() });
  return snapshot;
}

async function getFxRates(force = false): Promise<FxRates> {
  if (!force && fxCache && Date.now() - fxCache.fetchedAt < FX_TTL_MS) {
    return fxCache.rates;
  }
  const [usd, jpy, eur] = await Promise.allSettled([
    yf.quote("KRW=X"),
    yf.quote("JPYKRW=X"),
    yf.quote("EURKRW=X")
  ]);
  const prev = fxCache?.rates;
  const rates: FxRates = {
    USD: usd.status === "fulfilled" && usd.value.regularMarketPrice
      ? usd.value.regularMarketPrice : prev?.USD ?? 1400,
    JPY: jpy.status === "fulfilled" && jpy.value.regularMarketPrice
      ? jpy.value.regularMarketPrice : prev?.JPY ?? 9.5,
    EUR: eur.status === "fulfilled" && eur.value.regularMarketPrice
      ? eur.value.regularMarketPrice : prev?.EUR ?? 1600
  };
  fxCache = { rates, fetchedAt: Date.now() };
  return rates;
}

// ---------------------------------------------------------------------------
// Rule-based dividend safety score, derived only from real metrics
// ---------------------------------------------------------------------------
function computeSafetyScore(s: MarketSnapshot): number {
  let score = 55;
  score += Math.min(20, s.growthStreak * 2);
  if (s.payoutRatio !== null) {
    if (s.payoutRatio < 0.6) score += 15;
    else if (s.payoutRatio < 0.8) score += 8;
    else if (s.payoutRatio < 1.0) score += 2;
    else score -= 12;
  } else {
    score += 5; // ETFs/funds: diversified structure, payout ratio not applicable
  }
  if (s.dividendYield > 0.10) score -= 15;      // extreme yield → dividend-trap risk
  else if (s.dividendYield > 0.07) score -= 6;
  if (s.payoutFrequency === "Monthly" || s.payoutFrequency === "Quarterly") score += 4;
  return Math.max(20, Math.min(99, Math.round(score)));
}

function gradeFromScore(score: number): string {
  if (score >= 95) return "AAA";
  if (score >= 88) return "AA";
  if (score >= 80) return "A+";
  if (score >= 70) return "A";
  return "B";
}

// ---------------------------------------------------------------------------
// Gemini: qualitative commentary ONLY — every number comes from Yahoo Finance
// ---------------------------------------------------------------------------
async function generateQualitativeAnalysis(snapshot: MarketSnapshot): Promise<{
  name: string;
  analysis: string;
  pros: string[];
  cons: string[];
  safetyReason: string;
} | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const ai = new GoogleGenAI({ apiKey });
    const factSheet = {
      ticker: snapshot.displayTicker,
      companyName: snapshot.name,
      currency: snapshot.currency,
      currentPrice: snapshot.price,
      dividendYieldTTM: snapshot.dividendYield,
      ttmDividendPerShare: snapshot.ttmDividend,
      payoutRatio: snapshot.payoutRatio,
      dividendCAGR: snapshot.cagrBreakdown,
      consecutiveGrowthYears: snapshot.growthStreak,
      payoutFrequency: snapshot.payoutFrequency,
      annualDividendHistory: snapshot.historicalDividends,
      fundamentals: snapshot.fundamentals
    };

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: `다음은 Yahoo Finance에서 방금 조회한 "${snapshot.name}" (${snapshot.displayTicker}) 의 실측 배당 데이터입니다:

${JSON.stringify(factSheet, null, 2)}

위 실측 수치만을 근거로 배당 투자 관점의 정성 분석을 한국어로 작성해 주세요.
- 새로운 수치를 만들어내지 마세요. 위 데이터에 없는 구체적인 숫자는 언급하지 마세요.
- 회사의 사업 모델과 경제적 해자에 대한 일반적 지식은 활용해도 됩니다.`,
      config: {
        systemInstruction:
          "당신은 배당 투자 전문 애널리스트입니다. 제공된 실측 데이터를 왜곡하지 않고 정성적 해석만 제공합니다.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING, description: "종목의 자연스러운 한국어 표기 이름 (예: 리얼티 인컴 (Realty Income))" },
            analysis: { type: Type.STRING, description: "사업 모델, 해자, 배당 지속가능성에 대한 2~3문단 분석 (한국어)" },
            pros: { type: Type.ARRAY, items: { type: Type.STRING }, description: "배당 투자 장점 2~3개 (한국어)" },
            cons: { type: Type.ARRAY, items: { type: Type.STRING }, description: "배당 투자 리스크 2~3개 (한국어)" },
            safetyReason: { type: Type.STRING, description: "배당 안전성에 대한 1~2문장 요약 (한국어)" }
          },
          required: ["name", "analysis", "pros", "cons", "safetyReason"]
        }
      }
    });

    const text = response.text;
    if (!text) return null;
    return JSON.parse(text.trim());
  } catch (error: any) {
    console.warn(`Gemini qualitative analysis failed (${snapshot.symbol}):`, error.message || error);
    return null;
  }
}

// Honest numbers-only commentary used when Gemini is unavailable
function buildAutoCommentary(s: MarketSnapshot) {
  const freqKo =
    s.payoutFrequency === "Monthly" ? "매월" :
    s.payoutFrequency === "Quarterly" ? "분기마다" :
    s.payoutFrequency === "Semi-Annually" ? "반기마다" : "연 1회";

  const pros: string[] = [];
  const cons: string[] = [];

  if (s.growthStreak >= 5) pros.push(`최근 ${s.growthStreak}년 연속 연간 배당금 증가 (실측 데이터 기준)`);
  if (s.dividendGrowthRate >= 0.05) pros.push(`연평균 ${(s.dividendGrowthRate * 100).toFixed(1)}%의 배당 성장 이력`);
  if (s.payoutFrequency === "Monthly") pros.push("월 단위 배당 지급으로 재투자 주기가 짧음");
  if (s.dividendYield >= 0.04) pros.push(`최근 12개월 기준 ${(s.dividendYield * 100).toFixed(2)}%의 배당수익률`);
  if (pros.length === 0) pros.push("최근 12개월 배당 지급 이력 보유");

  if (s.payoutRatio !== null && s.payoutRatio >= 0.8) cons.push(`배당성향이 ${(s.payoutRatio * 100).toFixed(0)}%로 높아 이익 감소 시 배당 부담 가능`);
  if (s.dividendYield > 0.07) cons.push("배당수익률이 매우 높아 배당 삭감 리스크(고배당 함정) 점검 필요");
  if (s.dividendGrowthRate <= 0.02) cons.push("최근 배당 성장 속도가 완만함");
  if (cons.length === 0) cons.push("과거 배당 이력이 미래 배당을 보장하지 않음");

  const nonPayer = s.ttmDividend <= 0;
  return {
    name: s.name,
    analysis: nonPayer
      ? `${s.name}은(는) 최근 12개월간 배당 지급 이력이 확인되지 않는 종목입니다. 배당 복리 시뮬레이션 대상으로는 적합하지 않을 수 있습니다.\n\n(Gemini API 키가 설정되지 않아 AI 정성 분석 대신 실측 수치 기반 자동 요약이 표시됩니다.)`
      : `${s.name}의 실측 데이터 요약입니다. 현재 주가는 ${s.price.toLocaleString()} ${s.currency}이며, 최근 12개월 주당 배당금은 ${s.ttmDividend.toLocaleString()} ${s.currency} (배당수익률 약 ${(s.dividendYield * 100).toFixed(2)}%)입니다. 배당은 ${freqKo} 지급되었으며, ${s.growthStreak > 0 ? `${s.growthStreak}년 연속 연간 배당이 증가했습니다.` : "최근 연간 배당 증가 흐름은 확인되지 않았습니다."}\n\n(Gemini API 키가 설정되지 않아 AI 정성 분석 대신 실측 수치 기반 자동 요약이 표시됩니다.)`,
    pros,
    cons,
    safetyReason: `배당성향, 연속 증배 연수, 배당수익률, 지급 주기 등 실측 지표 기반의 규칙 점수입니다.`
  };
}

// ---------------------------------------------------------------------------
// Curated recommendation board: editorial text is hand-written, all numbers
// are fetched live from Yahoo Finance at request time.
// ---------------------------------------------------------------------------
interface RecommendationProfile {
  id: string;
  ticker: string;
  yahooSymbol: string;
  name: string;
  theme: string;
  themeName: string;
  description: string;
  analysis: string;
  scores: { yield: number; growth: number; safety: number; moat: number; overall: number };
  knownStreak: number; // used only when Yahoo's history window is shorter than the real streak
}

const RECOMMENDATION_PROFILES: RecommendationProfile[] = [
  {
    id: "rec-schd",
    ticker: "SCHD",
    yahooSymbol: "SCHD",
    name: "슈왑 미국 배당형 ETF (SCHD)",
    theme: "growth",
    themeName: "배당성장의 교과서",
    description: "미국 우량 기업 100개의 재무 건전성과 배당 성장을 동시에 잡는 대표 적립식 ETF",
    analysis: "다우존스 US 배당 100 지수를 추종하며, 부채 비율·ROE·배당성장 이력 등을 심사해 선별된 100개 종목에 분산 투자합니다. 2024년 10월 3대1 액면분할을 거쳐 접근성이 좋아졌으며, 장기 배당 성장 적립식 투자에서 가장 널리 쓰이는 ETF입니다.",
    scores: { yield: 72, growth: 92, safety: 96, moat: 95, overall: 93 },
    knownStreak: 12
  },
  {
    id: "rec-o",
    ticker: "O",
    yahooSymbol: "O",
    name: "리얼티 인컴 (Realty Income)",
    theme: "monthly",
    themeName: "매월 꼬박꼬박 월세 수령",
    description: "우량 유통 체인을 임차인으로 보유한 세계 최대 규모의 상업용 월배당 리츠",
    analysis: "월 단위 현금 흐름 재투자를 선호하는 투자자들이 가장 먼저 찾는 리츠입니다. 임차인이 세금·보험·유지비를 부담하는 트리플넷 임대 구조로 안정적인 현금흐름을 확보하며, 수십 년간 월배당을 지급해 왔습니다.",
    scores: { yield: 88, growth: 65, safety: 85, moat: 89, overall: 82 },
    knownStreak: 30
  },
  {
    id: "rec-ko",
    ticker: "KO",
    yahooSymbol: "KO",
    name: "코카콜라 (Coca-Cola)",
    theme: "dividend-king",
    themeName: "60년 이상 증배의 배당왕",
    description: "강력한 경제적 해자와 가격 결정력을 가진 대표 소비재 배당왕 주식",
    analysis: "60년 이상 경기 순환과 무관하게 배당을 인상해 온 배당왕(Dividend King)입니다. 막강한 글로벌 브랜드 독점력을 보유해 원자재 가격 상승 국면에서도 제품 가격 인상으로 마진을 방어합니다.",
    scores: { yield: 65, growth: 72, safety: 99, moat: 98, overall: 89 },
    knownStreak: 63
  },
  {
    id: "rec-mo",
    ticker: "MO",
    yahooSymbol: "MO",
    name: "알트리아 그룹 (Altria Group)",
    theme: "high-yield",
    themeName: "초고배당 캐시카우",
    description: "말보로 제조사로 높은 이익률과 현금 창출력을 지닌 고배당 기업",
    analysis: "흡연 인구 감소라는 장기 과제 속에서도 제품 단가 인상과 무연 제품군 확장으로 업계 최상위권 배당수익률을 유지해 온 기업입니다. 배당성향이 높은 만큼 규제 리스크는 상시 점검이 필요합니다.",
    scores: { yield: 98, growth: 60, safety: 70, moat: 85, overall: 81 },
    knownStreak: 55
  },
  {
    id: "rec-msft",
    ticker: "MSFT",
    yahooSymbol: "MSFT",
    name: "마이크로소프트 (Microsoft)",
    theme: "growth",
    themeName: "초고속 배당성장 & AI 대장",
    description: "배당수익률은 낮지만 강력한 현금 창출로 배당을 빠르게 늘려가는 기업",
    analysis: "현재 배당수익률은 낮지만 클라우드·AI·구독 매출 기반의 막강한 현금 창출력으로 배당을 빠르게 인상해 온 대표 배당성장주입니다. 장기 적립 시 인수 배당률(Yield on Cost)을 키우는 전략에 어울립니다.",
    scores: { yield: 25, growth: 98, safety: 99, moat: 99, overall: 91 },
    knownStreak: 22
  },
  {
    id: "rec-jpm",
    ticker: "JPM",
    yahooSymbol: "JPM",
    name: "JP모건 체이스 (JPMorgan Chase)",
    theme: "growth",
    themeName: "세계 1위 금융사 • 자본의 요새",
    description: "강력한 금리 마진과 안정적인 수수료 이익을 보유한 미국 대표 금융 지주회사",
    analysis: "글로벌 상업 금융과 투자 은행 부문의 선두 기업으로, 금융 위기 속에서도 높은 자본 건전성을 유지하며 성장해 왔습니다. 은행업 특성상 경기 둔화 시 대손충당금 부담은 존재합니다.",
    scores: { yield: 52, growth: 88, safety: 92, moat: 94, overall: 85 },
    knownStreak: 15
  },
  {
    id: "rec-mac",
    ticker: "088980",
    yahooSymbol: "088980.KS",
    name: "맥쿼리인프라 (Macquarie Korea Infrastructure)",
    theme: "high-yield",
    themeName: "국가 인프라 기반의 원화 현금흐름",
    description: "대한민국 도로·항만·교량 등 인프라 자산의 수입을 기반으로 분배금을 지급하는 상장 인프라 펀드",
    analysis: "유료 도로, 교량, 항만 등 국가 기반 시설에 투자하는 국내 대표 상장 인프라 펀드입니다. 통행료 수입이 물가와 연동되는 구조로 원화 현금흐름을 원하는 국내 배당 투자자들이 많이 찾습니다. 일부 자산의 운영 기간 만료에 따른 재투자 리스크는 존재합니다.",
    scores: { yield: 92, growth: 50, safety: 88, moat: 90, overall: 81 },
    knownStreak: 19
  }
];

function mergeProfileWithSnapshot(profile: RecommendationProfile, s: MarketSnapshot) {
  // Our dividend history starts in 1990, so a computed streak maxes out around
  // 35 years; longer real-world streaks (e.g. KO 60+y) keep the curated value.
  const effectiveStreak =
    s.growthStreak >= 30 && profile.knownStreak > s.growthStreak
      ? profile.knownStreak
      : s.growthStreak;

  const safetyScore = computeSafetyScore({ ...s, growthStreak: effectiveStreak });

  return {
    id: profile.id,
    ticker: profile.ticker,
    name: profile.name,
    currentPrice: s.price,
    currency: s.currency,
    dividendYield: s.dividendYield,
    payoutRatio: s.payoutRatio,
    dividendGrowthRate: s.dividendGrowthRate,
    payoutFrequency: s.payoutFrequency,
    payoutMonths: s.payoutMonths,
    growthStreak: effectiveStreak,
    safetyScore,
    theme: profile.theme,
    themeName: profile.themeName,
    description: profile.description,
    scores: profile.scores,
    analysis: profile.analysis,
    operatingMargin: s.fundamentals.operatingMargin,
    debtToEquity: s.fundamentals.debtToEquity,
    roe: s.fundamentals.roe,
    revenueGrowthYoY: s.fundamentals.revenueGrowthYoY,
    earningsGrowthYoY: s.fundamentals.earningsGrowthYoY,
    fundamentalGrade: gradeFromScore(safetyScore),
    historicalDividends: s.historicalDividends,
    cagrBreakdown: s.cagrBreakdown,
    marketTime: s.marketTime
  };
}

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------
async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

  // Current KRW exchange rates
  app.get("/api/fx", async (_req, res) => {
    try {
      const rates = await getFxRates();
      res.json({ rates, asOf: new Date().toLocaleString("ko-KR", { hour12: false }) });
    } catch (error: any) {
      res.status(502).json({ error: "환율 정보를 가져오지 못했습니다.", detail: error.message });
    }
  });

  // Recommendation board with live prices/dividend data
  app.get("/api/sync-recs", async (req, res) => {
    const force = req.query.force === "true";
    const nowStr = new Date().toLocaleString("ko-KR", { hour12: false });

    if (!force && recsCache && Date.now() - recsCache.fetchedAt < RECS_TTL_MS) {
      return res.json({ ...recsCache.payload, source: "cache" });
    }

    const results = await Promise.allSettled(
      RECOMMENDATION_PROFILES.map(p => getMarketSnapshot(p.yahooSymbol, force))
    );

    const recommendations: any[] = [];
    const failures: string[] = [];
    results.forEach((r, i) => {
      const profile = RECOMMENDATION_PROFILES[i];
      if (r.status === "fulfilled") {
        recommendations.push(mergeProfileWithSnapshot(profile, r.value));
      } else {
        failures.push(profile.ticker);
        // Reuse the last successfully synced entry if we have one
        const prev = recsCache?.payload?.recommendations?.find((x: any) => x.id === profile.id);
        if (prev) recommendations.push(prev);
      }
    });

    if (recommendations.length === 0) {
      return res.status(502).json({
        source: "error",
        lastSyncTime: nowStr,
        recommendations: [],
        warning: "실시간 시세 조회에 실패했습니다. 네트워크 상태를 확인한 뒤 다시 시도해 주세요."
      });
    }

    let fxRates: FxRates | null = null;
    try { fxRates = await getFxRates(); } catch { /* optional */ }

    const payload = {
      source: failures.length > 0 ? "yahoo-finance-partial" : "yahoo-finance",
      lastSyncTime: nowStr,
      fxRates,
      recommendations,
      ...(failures.length > 0
        ? { warning: `일부 종목(${failures.join(", ")})의 실시간 조회에 실패해 이전 데이터를 표시합니다.` }
        : {})
    };
    recsCache = { payload, fetchedAt: Date.now() };
    res.json(payload);
  });

  // Refresh live prices for the user's own portfolio holdings
  app.post("/api/refresh-quotes", async (req, res) => {
    const holdings: { ticker: string; currency?: string }[] = req.body?.holdings ?? [];
    if (!Array.isArray(holdings) || holdings.length === 0 || holdings.length > 50) {
      return res.status(400).json({ error: "holdings 배열(1~50개)이 필요합니다." });
    }

    const nowStr = new Date().toLocaleString("ko-KR", { hour12: false });
    const entries = await Promise.allSettled(
      holdings.map(async h => {
        const symbol = await resolveSymbol(h.ticker, h.currency);
        if (!symbol) throw new Error(`unresolved: ${h.ticker}`);
        const snap = await getMarketSnapshot(symbol);
        return { requested: h.ticker, snap };
      })
    );

    const quotes: Record<string, any> = {};
    const failures: string[] = [];
    entries.forEach((e, i) => {
      if (e.status === "fulfilled") {
        const { requested, snap } = e.value;
        quotes[requested] = {
          currentPrice: snap.price,
          currency: snap.currency,
          dividendYield: snap.dividendYield,
          dividendGrowthRate: snap.dividendGrowthRate,
          payoutFrequency: snap.payoutFrequency,
          payoutMonths: snap.payoutMonths,
          marketTime: snap.marketTime
        };
      } else {
        failures.push(holdings[i].ticker);
      }
    });

    let fxRates: FxRates | null = null;
    try { fxRates = await getFxRates(); } catch { /* optional */ }

    res.json({ quotes, failures, fxRates, asOf: nowStr });
  });

  // Full single-stock analysis: real numbers from Yahoo, commentary from Gemini
  app.post("/api/analyze-stock", async (req, res) => {
    const { ticker, country } = req.body ?? {};
    if (!ticker || typeof ticker !== "string") {
      return res.status(400).json({ error: "티커 또는 종목명을 입력해 주세요." });
    }

    let symbol: string | null = null;
    try {
      symbol = await resolveSymbol(ticker, country);
    } catch { /* handled below */ }
    if (!symbol) {
      return res.status(404).json({
        error: `'${ticker}' 종목을 찾을 수 없습니다. 정확한 티커(예: AAPL, SCHD)나 6자리 종목코드(예: 005930), 또는 정확한 한글 종목명을 입력해 주세요.`
      });
    }

    let snapshot: MarketSnapshot;
    try {
      snapshot = await getMarketSnapshot(symbol);
    } catch (error: any) {
      return res.status(502).json({
        error: `'${ticker}' 종목의 시세 데이터를 가져오지 못했습니다. 잠시 후 다시 시도해 주세요.`
      });
    }

    const qualitative = (await generateQualitativeAnalysis(snapshot)) ?? buildAutoCommentary(snapshot);
    const safetyScore = computeSafetyScore(snapshot);

    res.json({
      ticker: snapshot.displayTicker,
      name: qualitative.name || snapshot.name,
      currentPrice: snapshot.price,
      currency: snapshot.currency,
      dividendYield: snapshot.dividendYield,
      payoutRatio: snapshot.payoutRatio ?? 0,
      dividendGrowthRate: snapshot.dividendGrowthRate,
      payoutFrequency: snapshot.payoutFrequency,
      payoutMonths: snapshot.payoutMonths,
      growthStreak: snapshot.growthStreak,
      safetyScore,
      safetyReason: qualitative.safetyReason,
      analysis: qualitative.analysis,
      pros: qualitative.pros,
      cons: qualitative.cons,
      historicalDividends: snapshot.historicalDividends,
      cagrBreakdown: snapshot.cagrBreakdown,
      dataSource: "Yahoo Finance",
      asOf: snapshot.marketTime
    });
  });

  // Serve static assets or use Vite middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
