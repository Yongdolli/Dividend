import React, { useState, useMemo, useEffect } from "react";
import { Stock } from "../types";
import { 
  Award, 
  Plus, 
  Check, 
  Sparkles, 
  Flame, 
  ShieldCheck, 
  TrendingUp, 
  Calendar, 
  HelpCircle,
  TrendingDown,
  Info,
  ChevronRight,
  RefreshCw,
  CheckCircle2
} from "lucide-react";
interface RecommendedStock {
  id: string;
  ticker: string;
  name: string;
  currentPrice: number;
  currency: string;
  dividendYield: number;
  payoutRatio?: number | null;
  dividendGrowthRate: number;
  payoutFrequency: Stock["payoutFrequency"];
  payoutMonths?: number[];
  growthStreak: number;
  safetyScore: number;
  theme: "high-yield" | "growth" | "dividend-king" | "monthly";
  themeName: string;
  description: string;
  scores: {
    yield: number;
    growth: number;
    safety: number;
    moat: number;
    overall: number;
  };
  analysis: string;
  // Live fundamentals from the market data API (null for ETFs/funds)
  operatingMargin: number | null;
  debtToEquity: number | null;
  roe: number | null;
  revenueGrowthYoY: number | null;
  earningsGrowthYoY: number | null;
  fundamentalGrade: "AAA" | "AA" | "A+" | "A" | "B";
  historicalDividends?: { year: string; amount: number }[];
  cagrBreakdown?: { period: string; year?: string; rate: number }[];
  marketTime?: string | null;
}

interface DividendRecommendationsProps {
  onAddStock: (stock: Stock) => void;
  onAddMultipleStocks?: (stocks: Stock[]) => void;
  existingTickers: string[];
}

const RECS_CACHE_KEY = "dividend_recs_cache_v2";

export default function DividendRecommendations({ onAddStock, onAddMultipleStocks, existingTickers }: DividendRecommendationsProps) {
  // First paint from the last synced snapshot; live data replaces it right after mount
  const [recs, setRecs] = useState<RecommendedStock[]>(() => {
    try {
      const cached = localStorage.getItem(RECS_CACHE_KEY);
      if (cached) return JSON.parse(cached);
    } catch { /* corrupted cache — start empty */ }
    return [];
  });
  const [selectedTheme, setSelectedTheme] = useState<"all" | "high-yield" | "growth" | "dividend-king" | "monthly">("all");
  const [selectedFundamentalFilter, setSelectedFundamentalFilter] = useState<"all" | "high-growth" | "low-debt" | "high-margin">("all");
  const [hoveredStockId, setHoveredStockId] = useState<string | null>(null);

  // Live sync states
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState("");
  const [syncWarning, setSyncWarning] = useState<string | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [autoSync, setAutoSync] = useState(true);

  const fetchRecommendations = async (force: boolean = false) => {
    if (isSyncing) return;
    setIsSyncing(true);
    setSyncWarning(null);
    setSyncStatus(force ? "Yahoo Finance에서 전체 종목 실시간 재조회 중..." : "실시간 주가 및 배당 데이터 동기화 중...");
    try {
      const res = await fetch(`/api/sync-recs${force ? "?force=true" : ""}`);
      const result = await res.json().catch(() => null);
      if (res.ok && result?.recommendations && Array.isArray(result.recommendations) && result.recommendations.length > 0) {
        setRecs(result.recommendations);
        setLastSyncTime(result.lastSyncTime);
        localStorage.setItem(RECS_CACHE_KEY, JSON.stringify(result.recommendations));
        localStorage.setItem("dividend_recs_last_sync", result.lastSyncTime);
        if (result.warning) setSyncWarning(result.warning);
      } else {
        setSyncWarning(result?.warning || "실시간 시세 조회에 실패했습니다. 마지막으로 동기화된 데이터를 표시합니다.");
      }
    } catch (err) {
      console.error("Failed to fetch recommendations:", err);
      setSyncWarning("서버에 연결하지 못했습니다. 마지막으로 동기화된 데이터를 표시합니다.");
    } finally {
      setIsSyncing(false);
      setSyncStatus("");
    }
  };

  useEffect(() => {
    const cachedTime = localStorage.getItem("dividend_recs_last_sync");
    const cachedAutoSync = localStorage.getItem("dividend_recs_autosync");

    if (cachedTime) {
      setLastSyncTime(cachedTime);
    }
    if (cachedAutoSync !== null) {
      setAutoSync(cachedAutoSync === "true");
    }

    // Fetch live values on boot
    fetchRecommendations(false);
  }, []);

  // Live Fact Check & Dynamic Update Handler
  const handleLiveFactCheck = async () => {
    await fetchRecommendations(true);
  };

  // Perform auto background sync if date changed
  useEffect(() => {
    if (!autoSync || recs.length === 0 || isSyncing) return;
    const todayStr = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    const cachedTime = localStorage.getItem("dividend_recs_last_sync");
    if (cachedTime) {
      const lastSyncDate = cachedTime.split(" ")[0]; // Get the date portion
      const isDifferentDay = !cachedTime.includes(todayStr) && !cachedTime.startsWith(new Date().toLocaleDateString("ko-KR").split(" ")[0]);
      
      if (isDifferentDay) {
        // Run auto update in background
        fetchRecommendations(false);
      }
    }
  }, [autoSync, recs.length]);

  // Handle toggling auto sync setting
  const handleToggleAutoSync = () => {
    const nextVal = !autoSync;
    setAutoSync(nextVal);
    localStorage.setItem("dividend_recs_autosync", String(nextVal));
  };

  // Filter recommendations based on tab and fundamental choice
  const filteredRecommendations = useMemo(() => {
    let list = recs;
    if (selectedTheme !== "all") {
      list = list.filter(item => item.theme === selectedTheme);
    }
    if (selectedFundamentalFilter === "high-growth") {
      list = list.filter(item => (item.revenueGrowthYoY ?? 0) >= 0.06 || (item.earningsGrowthYoY ?? 0) >= 0.08);
    } else if (selectedFundamentalFilter === "low-debt") {
      list = list.filter(item => item.debtToEquity != null && item.debtToEquity <= 0.80);
    } else if (selectedFundamentalFilter === "high-margin") {
      list = list.filter(item => (item.operatingMargin ?? 0) >= 0.30);
    }
    return list;
  }, [recs, selectedTheme, selectedFundamentalFilter]);

  const mapRecommendedToStock = (rec: RecommendedStock, customShares: number = 10): Stock => {
    return {
      id: `rec-${rec.ticker}`,
      ticker: rec.ticker,
      name: rec.name,
      currentPrice: rec.currentPrice,
      purchasePrice: rec.currentPrice, // 담는 시점의 현재가를 매수 평단가 기본값으로
      currency: rec.currency,
      dividendYield: rec.dividendYield,
      payoutRatio: rec.payoutRatio ?? 0,
      dividendGrowthRate: rec.dividendGrowthRate,
      payoutFrequency: rec.payoutFrequency,
      payoutMonths: rec.payoutMonths,
      growthStreak: rec.growthStreak,
      safetyScore: rec.safetyScore,
      safetyReason: rec.description,
      analysis: rec.analysis,
      pros: ["큐레이션 추천 종목 — 상세 근거는 'AI 종목 배당 분석' 탭에서 확인 가능"],
      cons: ["과거 배당 이력이 미래 배당을 보장하지 않음"],
      sharesOwned: customShares,
      // Real per-share dividend history synced from the market data API
      historicalDividends: rec.historicalDividends,
      cagrBreakdown: rec.cagrBreakdown?.map(c => ({ period: c.period, rate: c.rate }))
    };
  };

  const handleAdd = (rec: RecommendedStock) => {
    const fullStock = mapRecommendedToStock(rec);
    onAddStock(fullStock);
  };

  const handleApplyBundle = (type: "top3" | "cashflow" | "all-in-one") => {
    if (!onAddMultipleStocks) return;

    let selectedRecs: { rec: RecommendedStock; shares: number }[] = [];
    if (type === "top3") {
      // Top 3 Elite Growth Stocks
      const schd = recs.find(r => r.ticker === "SCHD");
      const msft = recs.find(r => r.ticker === "MSFT");
      const ko = recs.find(r => r.ticker === "KO");
      if (schd) selectedRecs.push({ rec: schd, shares: 20 });
      if (msft) selectedRecs.push({ rec: msft, shares: 5 });
      if (ko) selectedRecs.push({ rec: ko, shares: 15 });
    } else if (type === "cashflow") {
      // High yield & monthly cashflow
      const o = recs.find(r => r.ticker === "O");
      const mo = recs.find(r => r.ticker === "MO");
      const mac = recs.find(r => r.ticker === "088980");
      if (o) selectedRecs.push({ rec: o, shares: 30 });
      if (mo) selectedRecs.push({ rec: mo, shares: 25 });
      if (mac) selectedRecs.push({ rec: mac, shares: 100 });
    } else {
      // All Recommended Assets
      recs.forEach(rec => {
        const defaultShares = rec.currency === "KRW" ? 100 : 15;
        selectedRecs.push({ rec, shares: defaultShares });
      });
    }

    const stocksToAdd = selectedRecs.map(({ rec, shares }) => mapRecommendedToStock(rec, shares));
    onAddMultipleStocks(stocksToAdd);
  };

  // Metric color helper
  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-emerald-600 bg-emerald-50 border-emerald-100";
    if (score >= 75) return "text-indigo-600 bg-indigo-50 border-indigo-100";
    if (score >= 50) return "text-amber-600 bg-amber-50 border-amber-100";
    return "text-rose-600 bg-rose-50 border-rose-100";
  };

  return (
    <div className="space-y-6">
      {/* Dynamic Header & Curated Engine Philosophy */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs space-y-4 overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="font-bold text-slate-800 text-lg flex items-center gap-1.5 font-display">
              <Award className="w-5.5 h-5.5 text-indigo-600" />
              AI 배당 평가 스코어보드 & 추천 랭킹
            </h3>
            <p className="text-xs text-slate-400">
              배당수익성, 미래 배당성장력, 지급 안전성, 경제적 해자 점수를 기반으로 도출한 검증된 글로벌 우량 배당주 리스트입니다.
            </p>
          </div>
          
          <div className="flex flex-wrap gap-1.5 bg-slate-50 border border-slate-100 p-1 rounded-xl text-xs font-semibold self-start lg:self-auto">
            {[
              { id: "all", label: "전체 목록" },
              { id: "growth", label: "배당성장형" },
              { id: "high-yield", label: "초고배당형" },
              { id: "monthly", label: "월배당 포커스" },
              { id: "dividend-king", label: "배당왕 코어" }
            ].map(theme => (
              <button
                key={theme.id}
                onClick={() => setSelectedTheme(theme.id as any)}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  selectedTheme === theme.id
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
                }`}
              >
                {theme.label}
              </button>
            ))}
          </div>
        </div>

        {/* Fundamental & Financial Soundness Filters */}
        <div className="pt-4 border-t border-slate-100/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-600 font-bold">
            <TrendingUp className="w-4 h-4 text-emerald-600" />
            <span>📊 기업 펀더멘탈 & 성장성 필터:</span>
            <span className="text-[10px] text-slate-400 font-normal">배당뿐만 아니라 성장과 기업 체력까지 정밀 진단</span>
          </div>

          <div className="flex flex-wrap gap-1 bg-slate-50 border border-slate-100 p-1 rounded-xl text-[11px] font-bold">
            {[
              { id: "all", label: "전체 조건" },
              { id: "high-growth", label: "📈 고성장 우량주 (YoY 6%+)" },
              { id: "low-debt", label: "🛡️ 초탄탄 부채비율 (80%↓)" },
              { id: "high-margin", label: "💰 독과점 고마진 (30%↑)" }
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setSelectedFundamentalFilter(f.id as any)}
                className={`px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                  selectedFundamentalFilter === f.id
                    ? "bg-slate-800 text-white shadow-xs"
                    : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Live Market Data Sync Panel */}
        <div className="pt-4 border-t border-slate-100/70 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-indigo-50/20 -mx-6 px-6 py-4 rounded-b-2xl border-b border-indigo-100/10">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isSyncing ? "bg-amber-500 animate-pulse" : syncWarning ? "bg-amber-500" : "bg-emerald-500 animate-ping"}`} />
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                실시간 시세 동기화: {isSyncing ? "조회 진행 중..." : syncWarning ? "일부 실패" : "완료"}
              </span>
              {lastSyncTime && (
                <span className="text-[10px] text-indigo-600 font-mono font-bold">
                  (마지막 업데이트: {lastSyncTime})
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500">
              {isSyncing ? (
                <span className="text-indigo-600 font-semibold animate-pulse">{syncStatus}</span>
              ) : syncWarning ? (
                <span className="text-amber-600 font-semibold">{syncWarning}</span>
              ) : (
                "주가·배당수익률·연속 증배 연수·재무비율은 Yahoo Finance 실시간 데이터이며, 종목 해설과 테마 점수는 큐레이션된 참고 자료입니다."
              )}
            </p>
          </div>

          <div className="flex items-center gap-3 self-end md:self-auto shrink-0">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-600">
              <input
                type="checkbox"
                checked={autoSync}
                onChange={handleToggleAutoSync}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
              />
              <span>매일 자동 동기화</span>
            </label>

            <button
              onClick={() => handleLiveFactCheck()}
              disabled={isSyncing}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                isSyncing
                  ? "bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed"
                  : "bg-white border-indigo-100 hover:border-indigo-200 text-indigo-600 hover:bg-indigo-50/50 shadow-3xs"
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin text-amber-500" : ""}`} />
              <span>실시간 시세 동기화</span>
            </button>
          </div>
        </div>
      </div>

      {/* One-Click Recommended Bundle Setup */}
      <div className="bg-gradient-to-r from-indigo-50/70 to-emerald-50/70 rounded-2xl border border-indigo-100/80 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="space-y-1">
            <h4 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
              <Sparkles className="w-4.5 h-4.5 text-indigo-600 animate-pulse" />
              추천 랭킹 기반 원클릭 포트폴리오 패키지 설계
            </h4>
            <p className="text-xs text-slate-500">
              순위와 자산 균형을 반영해 구성된 고품격 시뮬레이션 패키지를 원클릭으로 일괄 적립해보세요.
            </p>
          </div>
          <span className="text-[10px] bg-indigo-600 text-white font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider font-mono">
            Super Fast Setup
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Bundle 1: Top 3 Core Elite */}
          <button
            onClick={() => handleApplyBundle("top3")}
            className="group bg-white hover:bg-slate-50/50 border border-slate-150 rounded-xl p-4 text-left transition-all duration-300 hover:shadow-xs hover:border-indigo-300 cursor-pointer flex flex-col justify-between space-y-3"
          >
            <div className="space-y-1">
              <span className="text-[9px] bg-indigo-50 text-indigo-700 font-extrabold px-1.5 py-0.5 rounded-md uppercase font-mono">
                Bundle A • 성장 복리형
              </span>
              <h5 className="font-extrabold text-slate-800 text-xs">최정예 배당 엘리트 (Top 3)</h5>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                SCHD(20주), MSFT(5주), KO(15주)의 가치 성장과 배당안정성을 믹스한 완벽 연금 기초 팩
              </p>
            </div>
            <div className="flex justify-between items-center text-[10px] font-bold text-indigo-600 pt-2 border-t border-slate-100 w-full group-hover:text-indigo-700">
              <span>내 포트폴리오에 자동 로드</span>
              <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
            </div>
          </button>

          {/* Bundle 2: Cashflow Focus */}
          <button
            onClick={() => handleApplyBundle("cashflow")}
            className="group bg-white hover:bg-slate-50/50 border border-slate-150 rounded-xl p-4 text-left transition-all duration-300 hover:shadow-xs hover:border-emerald-300 cursor-pointer flex flex-col justify-between space-y-3"
          >
            <div className="space-y-1">
              <span className="text-[9px] bg-emerald-50 text-emerald-700 font-extrabold px-1.5 py-0.5 rounded-md uppercase font-mono">
                Bundle B • 현금 강화형
              </span>
              <h5 className="font-extrabold text-slate-800 text-xs">월세형 캐시플로우 파이프라인</h5>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                O(30주), MO(25주), 맥쿼리인프라(100주)의 매달 마르지 않는 초강력 현금 배당 중심 팩
              </p>
            </div>
            <div className="flex justify-between items-center text-[10px] font-bold text-emerald-600 pt-2 border-t border-slate-100 w-full group-hover:text-emerald-700">
              <span>내 포트폴리오에 자동 로드</span>
              <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
            </div>
          </button>

          {/* Bundle 3: All-in-one */}
          <button
            onClick={() => handleApplyBundle("all-in-one")}
            className="group bg-white hover:bg-slate-50/50 border border-slate-150 rounded-xl p-4 text-left transition-all duration-300 hover:shadow-xs hover:border-amber-300 cursor-pointer flex flex-col justify-between space-y-3"
          >
            <div className="space-y-1">
              <span className="text-[9px] bg-amber-50 text-amber-700 font-extrabold px-1.5 py-0.5 rounded-md uppercase font-mono">
                Bundle C • 철벽 분산형
              </span>
              <h5 className="font-extrabold text-slate-800 text-xs">AI 추천 7대 우량주 통합 올인원 팩</h5>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                안심하고 묻어두는 7대 글로벌 우량을 고루 분산 탑재하여 마켓 하락을 완벽 방어하는 요새 팩
              </p>
            </div>
            <div className="flex justify-between items-center text-[10px] font-bold text-amber-600 pt-2 border-t border-slate-100 w-full group-hover:text-amber-700">
              <span>내 포트폴리오에 자동 로드</span>
              <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
            </div>
          </button>
        </div>
      </div>

      {/* Empty state while the very first live sync is running */}
      {recs.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center text-slate-400 space-y-2">
          <RefreshCw className={`w-8 h-8 mx-auto opacity-50 ${isSyncing ? "animate-spin" : ""}`} />
          <p className="text-sm">
            {isSyncing ? "Yahoo Finance에서 추천 종목 실시간 데이터를 불러오는 중입니다..." : "추천 종목 데이터를 아직 불러오지 못했습니다. '실시간 시세 동기화' 버튼으로 다시 시도해 주세요."}
          </p>
        </div>
      )}

      {/* Grid of Recommendation Scoreboards */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {filteredRecommendations.map((rec, index) => {
          const isAdded = existingTickers.includes(rec.ticker);
          const isUSD = rec.currency === "USD";
          const formattedPrice = isUSD ? `$${rec.currentPrice.toLocaleString()}` : `${rec.currentPrice.toLocaleString()}원`;

          return (
            <div
              key={rec.id}
              onMouseEnter={() => setHoveredStockId(rec.id)}
              onMouseLeave={() => setHoveredStockId(null)}
              className={`bg-white rounded-2xl border transition-all duration-300 p-6 flex flex-col justify-between ${
                hoveredStockId === rec.id
                  ? "border-indigo-200 shadow-md shadow-slate-100 translate-y-[-2px]"
                  : "border-slate-100 shadow-xs"
              }`}
            >
              <div className="space-y-4">
                {/* Header Identity of Card */}
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-extrabold text-xs font-mono text-indigo-600 bg-indigo-50 border border-indigo-100 px-2.5 py-0.5 rounded-md">
                        RANK {index + 1} • {rec.ticker}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400 font-mono bg-slate-50 border px-1.5 py-0.5 rounded-md">
                        {rec.payoutFrequency === "Monthly" ? "월배당" : rec.payoutFrequency === "Quarterly" ? "분기배당" : rec.payoutFrequency === "Semi-Annually" ? "반기배당" : "연배당"}
                      </span>
                    </div>
                    <h4 className="font-bold text-slate-800 text-base line-clamp-1">{rec.name}</h4>
                    <p className="text-slate-400 text-xs font-medium">{rec.description}</p>
                  </div>

                  <span className="text-[11px] font-bold text-indigo-700 font-mono bg-indigo-50/50 border border-indigo-100 px-2.5 py-1 rounded-full whitespace-nowrap">
                    {rec.themeName}
                  </span>
                </div>

                {/* Score Dashboard Visualizer (Fidelity Radar bars) */}
                <div className="bg-slate-50/60 border border-slate-100 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                    <span className="flex items-center gap-1">
                      <Sparkles className="w-4 h-4 text-indigo-600" />
                      배당 종합 평가 점수
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full border text-sm font-extrabold ${getScoreColor(rec.scores.overall)}`}>
                      {rec.scores.overall}점
                    </span>
                  </div>

                  {/* Horizontal Bar charts */}
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2.5 text-[11px] font-medium text-slate-500">
                    {/* Yield score */}
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span>배당 매력도 (Yield)</span>
                        <span className="font-bold text-slate-700 font-mono">{rec.scores.yield}%</span>
                      </div>
                      <div className="w-full bg-slate-200/60 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-indigo-600 h-full rounded-full" style={{ width: `${rec.scores.yield}%` }}></div>
                      </div>
                    </div>

                    {/* Growth score */}
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span>배당 성장성 (Growth)</span>
                        <span className="font-bold text-slate-700 font-mono">{rec.scores.growth}%</span>
                      </div>
                      <div className="w-full bg-slate-200/60 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-indigo-600 h-full rounded-full" style={{ width: `${rec.scores.growth}%` }}></div>
                      </div>
                    </div>

                    {/* Safety score */}
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span>지급 안전성 (Safety)</span>
                        <span className="font-bold text-slate-700 font-mono">{rec.scores.safety}%</span>
                      </div>
                      <div className="w-full bg-slate-200/60 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-emerald-600 h-full rounded-full" style={{ width: `${rec.scores.safety}%` }}></div>
                      </div>
                    </div>

                    {/* Moat score */}
                    <div className="space-y-1">
                      <div className="flex justify-between">
                        <span>브랜드 독점력 (Moat)</span>
                        <span className="font-bold text-slate-700 font-mono">{rec.scores.moat}%</span>
                      </div>
                      <div className="w-full bg-slate-200/60 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-amber-500 h-full rounded-full" style={{ width: `${rec.scores.moat}%` }}></div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Core Stock Dividend Specs */}
                <div className="grid grid-cols-4 gap-2 text-center text-xs">
                  <div className="bg-slate-50 rounded-lg p-2 border border-slate-100/50">
                    <span className="text-slate-400 text-[10px] block font-semibold">배당률</span>
                    <strong className="text-slate-800 text-sm font-mono block">{(rec.dividendYield * 100).toFixed(2)}%</strong>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-2 border border-slate-100/50">
                    <span className="text-slate-400 text-[10px] block font-semibold">배당성장 (5Y)</span>
                    <strong className="text-emerald-600 text-sm font-mono block">+{(rec.dividendGrowthRate * 100).toFixed(1)}%</strong>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-2 border border-slate-100/50">
                    <span className="text-slate-400 text-[10px] block font-semibold">연속 증배</span>
                    <strong className="text-slate-800 text-sm font-mono block">{rec.growthStreak}년</strong>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-2 border border-slate-100/50">
                    <span className="text-slate-400 text-[10px] block font-semibold">현재 주가</span>
                    <strong className="text-slate-700 text-sm font-mono block truncate">{formattedPrice}</strong>
                  </div>
                </div>

                {/* 📊 Corporate Fundamental & Financial Health Diagnostics */}
                <div className="bg-slate-50/40 border border-slate-100 rounded-xl p-4 space-y-3 animate-in fade-in duration-300">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                    <span className="flex items-center gap-1.5">
                      <TrendingUp className="w-4 h-4 text-emerald-600" />
                      기업 펀더멘탈 & 안정성 정밀진단
                    </span>
                    <span className="text-[10px] bg-slate-850 text-white font-mono px-2 py-0.5 rounded-md font-extrabold">
                      재무 등급: {rec.fundamentalGrade}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-[11px]">
                    <div className="bg-white rounded-lg p-2 border border-slate-100 shadow-3xs flex flex-col justify-between">
                      <span className="text-slate-400 font-semibold block">매출성장 (YoY)</span>
                      <strong className={`font-mono text-xs mt-1 block ${(rec.revenueGrowthYoY ?? 0) > 0 ? "text-emerald-600" : "text-slate-500"}`}>
                        {rec.revenueGrowthYoY != null ? `${rec.revenueGrowthYoY > 0 ? "+" : ""}${(rec.revenueGrowthYoY * 100).toFixed(1)}%` : "—"}
                      </strong>
                    </div>
                    <div className="bg-white rounded-lg p-2 border border-slate-100 shadow-3xs flex flex-col justify-between">
                      <span className="text-slate-400 font-semibold block">순이익성장 (YoY)</span>
                      <strong className={`font-mono text-xs mt-1 block ${(rec.earningsGrowthYoY ?? 0) > 0 ? "text-emerald-600" : "text-slate-500"}`}>
                        {rec.earningsGrowthYoY != null ? `${rec.earningsGrowthYoY > 0 ? "+" : ""}${(rec.earningsGrowthYoY * 100).toFixed(1)}%` : "—"}
                      </strong>
                    </div>
                    <div className="bg-white rounded-lg p-2 border border-slate-100 shadow-3xs flex flex-col justify-between col-span-2 sm:col-span-1">
                      <span className="text-slate-400 font-semibold block">부채비율 (D/E)</span>
                      <strong className={`font-mono text-xs mt-1 block ${rec.debtToEquity == null ? "text-slate-500" : rec.debtToEquity <= 0.80 ? "text-emerald-600" : rec.debtToEquity <= 1.5 ? "text-slate-600" : "text-amber-600"}`}>
                        {rec.debtToEquity != null ? `${(rec.debtToEquity * 100).toFixed(0)}%` : "—"}
                      </strong>
                    </div>
                    <div className="bg-white rounded-lg p-2 border border-slate-100 shadow-3xs flex flex-col justify-between">
                      <span className="text-slate-400 font-semibold block">영업이익률</span>
                      <strong className="text-slate-800 font-mono text-xs mt-1 block">
                        {rec.operatingMargin != null ? `${(rec.operatingMargin * 100).toFixed(0)}%` : "—"}
                      </strong>
                    </div>
                    <div className="bg-white rounded-lg p-2 border border-slate-100 shadow-3xs flex flex-col justify-between">
                      <span className="text-slate-400 font-semibold block">자기자본이익률(ROE)</span>
                      <strong className="text-indigo-600 font-mono text-xs mt-1 block">
                        {rec.roe != null ? `${(rec.roe * 100).toFixed(1)}%` : "—"}
                      </strong>
                    </div>
                    <div className="bg-white rounded-lg p-2 border border-slate-100 shadow-3xs flex flex-col justify-between">
                      <span className="text-slate-400 font-semibold block">배당 지속력</span>
                      <strong className="text-slate-700 font-mono text-[10px] mt-1.5 block">
                        {rec.safetyScore >= 90 ? "최상급 (Fortress)" : rec.safetyScore >= 80 ? "안정적 (Solid)" : "보통 (Monitored)"}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* AI Analyst opinion summary */}
                <p className="text-xs text-slate-500 leading-relaxed bg-indigo-50/20 border border-indigo-100/30 p-3 rounded-xl italic">
                  "{rec.analysis}"
                </p>
              </div>

              {/* Add to Portfolio Button Trigger */}
              <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between">
                <div className="text-[11px] text-slate-400 font-semibold flex items-center gap-1">
                  <Info className="w-3.5 h-3.5 text-slate-300" />
                  기본 10주 추가 모델링 가능
                </div>
                
                <button
                  onClick={() => handleAdd(rec)}
                  disabled={isAdded}
                  className={`px-4 py-2 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all ${
                    isAdded
                      ? "bg-slate-100 text-slate-400 border border-slate-200"
                      : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs cursor-pointer"
                  }`}
                >
                  {isAdded ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      내 포트폴리오 적립 중
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      포트폴리오 설계에 담기
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
