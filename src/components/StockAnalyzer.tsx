import React, { useState, useEffect, useMemo } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  AreaChart,
  Area
} from "recharts";
import { Stock } from "../types";
import { 
  Sparkles, 
  Search, 
  ShieldCheck, 
  ThumbsUp, 
  ThumbsDown, 
  Plus, 
  Check,
  TrendingUp,
  AlertTriangle,
  Loader2,
  Clock,
  ArrowUpRight,
  TrendingDown
} from "lucide-react";

interface StockAnalyzerProps {
  onAddStock: (stock: Stock) => void;
  existingTickers: string[];
}

export default function StockAnalyzer({ onAddStock, existingTickers }: StockAnalyzerProps) {
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState("USD");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analyzedStock, setAnalyzedStock] = useState<any | null>(null);
  const [added, setAdded] = useState(false);
  const [priceRange, setPriceRange] = useState<1 | 5 | 10>(5);

  // 주가 차트 데이터: 선택한 기간만큼 월봉 필터링
  const priceChartData = useMemo(() => {
    const history: { month: string; close: number }[] = analyzedStock?.priceHistory ?? [];
    if (history.length === 0) return [];
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - priceRange);
    const cutoffKey = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, "0")}`;
    return history.filter(p => p.month >= cutoffKey);
  }, [analyzedStock, priceRange]);

  const priceRangeReturn = useMemo(() => {
    if (priceChartData.length < 2) return null;
    const first = priceChartData[0].close;
    const last = priceChartData[priceChartData.length - 1].close;
    return first > 0 ? last / first - 1 : null;
  }, [priceChartData]);

  // Witty loading phrases
  const loadingPhrases = [
    "Yahoo Finance에서 실시간 시세와 배당 지급 이력을 조회 중입니다...",
    "최근 배당 성장 이력과 연속 증배 연수를 계산하고 있습니다...",
    "배당성향(Payout Ratio)과 배당 CAGR을 산출 중입니다...",
    "실측 데이터를 바탕으로 배당 안전성 점수를 계산하고 있습니다...",
    "AI가 기업의 사업 모델과 경제적 해자(Moat)에 대한 해설을 작성하는 중입니다..."
  ];
  const [phraseIdx, setPhraseIdx] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (loading) {
      interval = setInterval(() => {
        setPhraseIdx(prev => (prev + 1) % loadingPhrases.length);
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [loading]);

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    setAnalyzedStock(null);
    setAdded(false);
    setPhraseIdx(0);

    try {
      const response = await fetch("/api/analyze-stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker: query, country })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "분석 도중 오류가 발생했습니다.");
      }

      const data = await response.json();
      setAnalyzedStock(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "종목을 분석하지 못했습니다. 올바른 티커인지 확인해 주세요.");
    } finally {
      setLoading(false);
    }
  };

  const handleAddToPortfolio = () => {
    if (!analyzedStock) return;

    const fullStock: Stock = {
      id: `ai-${Date.now()}-${analyzedStock.ticker}`,
      ticker: analyzedStock.ticker,
      name: analyzedStock.name,
      currentPrice: analyzedStock.currentPrice,
      purchasePrice: analyzedStock.currentPrice, // 담는 시점의 현재가를 매수 평단가 기본값으로
      currency: analyzedStock.currency || country,
      dividendYield: analyzedStock.dividendYield,
      payoutRatio: analyzedStock.payoutRatio,
      dividendGrowthRate: analyzedStock.dividendGrowthRate,
      payoutFrequency: analyzedStock.payoutFrequency || "Quarterly",
      growthStreak: analyzedStock.growthStreak,
      safetyScore: analyzedStock.safetyScore,
      safetyReason: analyzedStock.safetyReason,
      analysis: analyzedStock.analysis,
      pros: analyzedStock.pros,
      cons: analyzedStock.cons,
      historicalDividends: analyzedStock.historicalDividends,
      cagrBreakdown: analyzedStock.cagrBreakdown,
      payoutMonths: analyzedStock.payoutMonths,
      sharesOwned: 10 // Default starter shares
    };

    onAddStock(fullStock);
    setAdded(true);
  };

  // Get safety category style
  const getSafetyStyles = (score: number) => {
    if (score >= 85) return { text: "매우 안전", color: "text-emerald-600 bg-emerald-50 border-emerald-200", fill: "bg-emerald-600" };
    if (score >= 70) return { text: "안전", color: "text-blue-600 bg-blue-50 border-blue-200", fill: "bg-blue-600" };
    if (score >= 50) return { text: "보통", color: "text-amber-600 bg-amber-50 border-amber-200", fill: "bg-amber-600" };
    return { text: "주의 / 고위험", color: "text-rose-600 bg-rose-50 border-rose-200", fill: "bg-rose-600" };
  };

  // Rule of 72 and Yield On Cost (YOC) Calculations
  const calcYieldOnCost = (currentYield: number, growthRate: number, years: number) => {
    return currentYield * Math.pow(1 + growthRate, years);
  };

  const calcDoublingYears = (growthRate: number) => {
    if (growthRate <= 0) return "측정 불가 (성장 정체)";
    const yrs = 72 / (growthRate * 100);
    return `${yrs.toFixed(1)}년`;
  };

  return (
    <div className="space-y-6" id="stock-analyzer">
      {/* Search Bar Panel */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs">
        <h3 className="font-semibold text-slate-800 text-lg mb-1 flex items-center gap-1.5 font-display">
          <Sparkles className="w-5 h-5 text-indigo-600" />
          배당 종목 실시간 분석기 (실측 데이터 + AI 해설)
        </h3>
        <p className="text-xs text-slate-400 mb-6">
          글로벌 주식의 티커나 이름(예: 코카콜라, O, SCHD, 삼성전자, 005930)을 입력하면 Yahoo Finance 실시간 시세·배당 이력으로 수치를 계산하고, AI가 정성 해설을 덧붙입니다.
        </p>

        <form onSubmit={handleAnalyze} className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="분석할 종목코드나 이름을 입력하세요 (예: AAPL, 스타벅스, SK하이닉스)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              disabled={loading}
              className="w-full text-sm pl-10 pr-4 py-3 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 rounded-xl bg-slate-50/50"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              disabled={loading}
              className="px-3 py-3 border border-slate-200 rounded-xl text-sm bg-white font-medium"
            >
              <option value="USD">미국 주식 ($)</option>
              <option value="KRW">한국 주식 (₩)</option>
              <option value="JPY">일본 주식 (¥)</option>
              <option value="EUR">유럽 주식 (€)</option>
            </select>
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  배당 빅데이터 분석 중...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  AI 분석 시작
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Loading Screen */}
      {loading && (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center shadow-xs space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-indigo-600 mx-auto" />
          <div className="space-y-1.5 max-w-md mx-auto">
            <h4 className="font-semibold text-slate-700 text-sm">배당 빅데이터 연산 중</h4>
            <p className="text-xs text-slate-400 min-h-8 animate-pulse">
              {loadingPhrases[phraseIdx]}
            </p>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-100 rounded-2xl p-6 text-center space-y-2">
          <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto" />
          <h4 className="font-bold text-rose-800 text-sm">분석 오류가 발생했습니다</h4>
          <p className="text-xs text-rose-600 max-w-md mx-auto">{error}</p>
        </div>
      )}

      {/* Analysis Result Dashboard */}
      {analyzedStock && !loading && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          
          {/* Left Column: Core Metrics & Visual Safety Score */}
          <div className="lg:col-span-4 space-y-6">
            {/* Header Identity Card */}
            <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs text-center space-y-3">
              <span className="inline-block text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-3 py-1 rounded-full font-mono">
                {analyzedStock.ticker}
              </span>
              <h3 className="text-xl font-bold text-slate-800 line-clamp-1">{analyzedStock.name}</h3>
              <p className="text-slate-500 text-sm font-mono">
                현재 주가: <strong className="text-slate-800">{analyzedStock.currency || country} {analyzedStock.currentPrice.toLocaleString()}</strong>
              </p>
              {analyzedStock.dataSource && (
                <p className="text-[10px] text-slate-400 font-mono">
                  데이터: {analyzedStock.dataSource}{analyzedStock.asOf ? ` • ${analyzedStock.asOf} 기준` : ""}
                </p>
              )}

              <button
                onClick={handleAddToPortfolio}
                disabled={added}
                className={`w-full py-2.5 text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
                  added 
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200" 
                    : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
                }`}
              >
                {added ? (
                  <>
                    <Check className="w-4 h-4" />
                    포트폴리오 추가 완료!
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    내 포트폴리오에 이 종목 담기 (10주)
                  </>
                )}
              </button>
            </div>

            {/* Dividend Safety Circle Score */}
            <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs text-center space-y-4">
              <h4 className="font-semibold text-slate-800 text-sm text-left flex items-center gap-1">
                <ShieldCheck className="w-4 h-4 text-indigo-600" />
                배당 안전성 종합 등급
              </h4>

              <div className="relative w-28 h-28 mx-auto flex items-center justify-center">
                {/* Visual Ring Mockup */}
                <svg className="w-full h-full transform -rotate-90">
                  <circle cx="56" cy="56" r="48" stroke="#f1f5f9" strokeWidth="8" fill="transparent" />
                  <circle 
                    cx="56" 
                    cy="56" 
                    r="48" 
                    stroke="#4f46e5" 
                    strokeWidth="8" 
                    fill="transparent" 
                    strokeDasharray={301.6} 
                    strokeDashoffset={301.6 - (301.6 * analyzedStock.safetyScore) / 100}
                    strokeLinecap="round" 
                  />
                </svg>
                <div className="absolute flex flex-col items-center">
                  <span className="text-2xl font-extrabold text-slate-800">{analyzedStock.safetyScore}점</span>
                  <span className="text-[10px] font-bold text-slate-400">100점 만점</span>
                </div>
              </div>

              <div className={`border rounded-xl px-3 py-1 text-xs font-bold inline-block ${getSafetyStyles(analyzedStock.safetyScore).color}`}>
                배당 신뢰도: {getSafetyStyles(analyzedStock.safetyScore).text}
              </div>

              <p className="text-xs text-slate-500 leading-relaxed text-left bg-slate-50 p-3 rounded-xl border border-slate-100">
                {analyzedStock.safetyReason}
              </p>
            </div>

            {/* Rule of 72 & Yield-on-Cost Compound Projections */}
            <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-xs space-y-4">
              <h4 className="font-semibold text-slate-800 text-sm flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-emerald-600" />
                장기 배당성장 복리 계산기
              </h4>
              
              <div className="space-y-3 bg-slate-50/70 rounded-xl p-3 border border-slate-100">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">배당금 2배 달성 시간</span>
                  <span className="font-extrabold text-emerald-600 font-mono">
                    {calcDoublingYears(analyzedStock.dividendGrowthRate)}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  (72의 법칙: 연평균 {(analyzedStock.dividendGrowthRate * 100).toFixed(1)}%로 증배될 시, 원금 배당이 정확히 2배가 되는 세월)
                </p>
              </div>

              <div className="space-y-2">
                <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">인수 배당률 (Yield on Cost) 예측</span>
                <div className="space-y-1.5 font-sans">
                  <div className="flex justify-between items-center text-xs py-1 border-b border-slate-100/50">
                    <span className="text-slate-500">현재 인수 배당률</span>
                    <span className="font-semibold text-slate-700">{(analyzedStock.dividendYield * 100).toFixed(2)}%</span>
                  </div>
                  <div className="flex justify-between items-center text-xs py-1 border-b border-slate-100/50">
                    <span className="text-slate-500">5년 후 인수 배당률</span>
                    <span className="font-bold text-indigo-600">{(calcYieldOnCost(analyzedStock.dividendYield, analyzedStock.dividendGrowthRate, 5) * 100).toFixed(2)}%</span>
                  </div>
                  <div className="flex justify-between items-center text-xs py-1 border-b border-slate-100/50">
                    <span className="text-slate-500">10년 후 인수 배당률</span>
                    <span className="font-bold text-indigo-700">{(calcYieldOnCost(analyzedStock.dividendYield, analyzedStock.dividendGrowthRate, 10) * 100).toFixed(2)}%</span>
                  </div>
                  <div className="flex justify-between items-center text-xs py-1">
                    <span className="text-slate-500">20년 후 인수 배당률</span>
                    <span className="font-bold text-emerald-600 text-sm">{(calcYieldOnCost(analyzedStock.dividendYield, analyzedStock.dividendGrowthRate, 20) * 100).toFixed(2)}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: AI Analysis details */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* 4 Core Financial Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-white rounded-2xl p-4 border border-slate-100 text-center space-y-1">
                <span className="text-slate-400 text-[10px] font-bold uppercase">연 배당수익률</span>
                <span className="text-lg font-bold text-indigo-600 block">{(analyzedStock.dividendYield * 100).toFixed(2)}%</span>
              </div>
              <div className="bg-white rounded-2xl p-4 border border-slate-100 text-center space-y-1">
                <span className="text-slate-400 text-[10px] font-bold uppercase">배당 성향</span>
                <span className="text-lg font-bold text-slate-800 block">{analyzedStock.payoutRatio ? `${(analyzedStock.payoutRatio * 100).toFixed(0)}%` : "—"}</span>
              </div>
              <div className="bg-white rounded-2xl p-4 border border-slate-100 text-center space-y-1">
                <span className="text-slate-400 text-[10px] font-bold uppercase">연평균 배당성장률</span>
                <span className="text-lg font-bold text-emerald-600 block">{(analyzedStock.dividendGrowthRate * 100).toFixed(1)}%</span>
              </div>
              <div className="bg-white rounded-2xl p-4 border border-slate-100 text-center space-y-1">
                <span className="text-slate-400 text-[10px] font-bold uppercase">연속 증배기간</span>
                <span className="text-lg font-bold text-indigo-800 block">{analyzedStock.growthStreak}년</span>
              </div>
            </div>

            {/* Price History Chart */}
            {priceChartData.length > 1 && (
              <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-xs space-y-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <h4 className="font-semibold text-slate-800 text-sm">주가 흐름 (월봉 종가)</h4>
                    <p className="text-[11px] text-slate-400">
                      최근 {priceRange}년 수익률{" "}
                      {priceRangeReturn !== null && (
                        <strong className={priceRangeReturn >= 0 ? "text-emerald-600" : "text-rose-600"}>
                          {priceRangeReturn >= 0 ? "+" : ""}{(priceRangeReturn * 100).toFixed(1)}%
                        </strong>
                      )}
                      <span className="text-slate-300"> (배당 제외, 시세만)</span>
                    </p>
                  </div>
                  <div className="flex gap-1 bg-slate-50 border border-slate-100 p-0.5 rounded-lg text-[11px] font-bold">
                    {([1, 5, 10] as const).map(r => (
                      <button
                        key={r}
                        onClick={() => setPriceRange(r)}
                        className={`px-2.5 py-1 rounded-md transition ${
                          priceRange === r ? "bg-indigo-600 text-white" : "text-slate-500 hover:bg-slate-100"
                        }`}
                      >
                        {r}년
                      </button>
                    ))}
                  </div>
                </div>

                <div className="h-52 w-full text-xs font-mono">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={priceChartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                      <defs>
                        <linearGradient id="saPrice" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="month" stroke="#94a3b8" tickLine={false} minTickGap={40} />
                      <YAxis stroke="#94a3b8" tickLine={false} domain={["auto", "auto"]} tickFormatter={(v) => Number(v).toLocaleString()} />
                      <Tooltip
                        formatter={(val: any) => [`${Number(val).toLocaleString()} ${analyzedStock.currency || country}`, "종가"]}
                        contentStyle={{ backgroundColor: "#1e293b", borderColor: "#1e293b", borderRadius: "8px", color: "#f8fafc" }}
                      />
                      <Area type="monotone" dataKey="close" stroke="#4f46e5" strokeWidth={2} fill="url(#saPrice)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Visual Historical Dividend Growth Trend Chart & CAGR Momentum */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* History Bar Chart */}
              <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-xs space-y-3">
                <div>
                  <h4 className="font-semibold text-slate-800 text-sm">연도별 배당금 성장 추세 (주당 배당금)</h4>
                  <p className="text-[11px] text-slate-400">최근 5년간 주주에게 환원된 연간 주당 배당수령액 추이</p>
                </div>

                <div className="h-48 w-full text-xs font-mono">
                  {analyzedStock.historicalDividends && analyzedStock.historicalDividends.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={analyzedStock.historicalDividends} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="year" stroke="#94a3b8" tickLine={false} />
                        <YAxis stroke="#94a3b8" tickLine={false} />
                        <Tooltip 
                          formatter={(val: any) => [`${Number(val).toLocaleString()} ${analyzedStock.currency || country}`, "주당 배당금"]}
                          contentStyle={{ backgroundColor: "#1e293b", borderColor: "#1e293b", borderRadius: "8px", color: "#f8fafc" }}
                        />
                        <Bar dataKey="amount" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-slate-400">데이터가 없습니다.</div>
                  )}
                </div>
              </div>

              {/* CAGR CAGR Milestones */}
              <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-xs space-y-4">
                <div>
                  <h4 className="font-semibold text-slate-800 text-sm">기간별 연평균 배당성장률 (CAGR)</h4>
                  <p className="text-[11px] text-slate-400">과거 다른 기간 동안의 복리 증배속도를 비교합니다.</p>
                </div>

                <div className="space-y-3 pt-1">
                  {analyzedStock.cagrBreakdown && analyzedStock.cagrBreakdown.length > 0 ? (
                    analyzedStock.cagrBreakdown.map((item: any, idx: number) => {
                      const isPositive = item.rate > 0;
                      return (
                        <div key={idx} className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-100 rounded-xl">
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${isPositive ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                            <span className="text-xs font-semibold text-slate-700">{item.period}</span>
                          </div>
                          <div className="flex items-center gap-1 font-mono text-xs font-bold">
                            {isPositive ? (
                              <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <TrendingDown className="w-3.5 h-3.5 text-slate-400" />
                            )}
                            <span className={isPositive ? "text-emerald-600" : "text-slate-500"}>
                              {(item.rate * 100).toFixed(2)}%
                            </span>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-xs text-slate-400">CAGR 분석 데이터가 없습니다.</div>
                  )}
                </div>
              </div>
            </div>

            {/* AI Deep Analysis Comments */}
            <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs space-y-4">
              <h4 className="font-semibold text-slate-800 text-base">AI 종합 재무 & 미래 현금흐름 전망</h4>
              <div className="text-xs text-slate-600 leading-relaxed whitespace-pre-line space-y-3">
                {analyzedStock.analysis}
              </div>
            </div>

            {/* Pros & Cons comparison */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Pros */}
              <div className="bg-emerald-50/50 border border-emerald-100/80 rounded-2xl p-5 space-y-3">
                <h4 className="text-emerald-800 font-bold text-xs flex items-center gap-1.5 uppercase tracking-wider">
                  <ThumbsUp className="w-4 h-4 text-emerald-600" />
                  배당 투자 메리트
                </h4>
                <ul className="space-y-2 text-xs text-emerald-950">
                  {analyzedStock.pros.map((pro: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-emerald-500 font-bold mt-0.5">•</span>
                      <span>{pro}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Cons */}
              <div className="bg-rose-50/50 border border-rose-100/80 rounded-2xl p-5 space-y-3">
                <h4 className="text-rose-800 font-bold text-xs flex items-center gap-1.5 uppercase tracking-wider">
                  <ThumbsDown className="w-4 h-4 text-rose-600" />
                  잠재적 투자 리스크
                </h4>
                <ul className="space-y-2 text-xs text-rose-950">
                  {analyzedStock.cons.map((con: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-rose-500 font-bold mt-0.5">•</span>
                      <span>{con}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
