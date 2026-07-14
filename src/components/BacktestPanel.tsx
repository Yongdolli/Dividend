import React, { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from "recharts";
import { Stock, SimulationConfig } from "../types";
import { formatCurrency, toKRW } from "../utils";
import {
  History,
  Play,
  Loader2,
  TrendingUp,
  Coins,
  AlertTriangle,
  Info,
  PiggyBank
} from "lucide-react";

interface BacktestPanelProps {
  stocks: Stock[];
  config: SimulationConfig;
}

interface BacktestResult {
  startMonth: string;
  endMonth: string;
  notes: string[];
  series: { month: string; value: number; contributions: number; cumDividends: number }[];
  summary: {
    finalValue: number;
    totalContributions: number;
    totalNetDividends: number;
    totalGain: number;
    totalReturnPct: number;
    approxCagr: number;
    yearsActual: number;
  };
  holdings: { ticker: string; weight: number; finalShares: number; finalValueKRW: number }[];
  assumptions: string;
}

export default function BacktestPanel({ stocks, config }: BacktestPanelProps) {
  const [years, setYears] = useState(10);
  const [initialCapital, setInitialCapital] = useState(config.initialCapital);
  const [monthlyContribution, setMonthlyContribution] = useState(config.monthlyContribution);
  const [reinvest, setReinvest] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BacktestResult | null>(null);

  // 현재 포트폴리오 평가액 기준 비중
  const weights = useMemo(() => {
    const values = stocks.map(s => s.sharesOwned * toKRW(s.currentPrice, s.currency));
    const total = values.reduce((a, b) => a + b, 0);
    return stocks.map((s, i) => ({
      ticker: s.ticker,
      currency: s.currency,
      weight: total > 0 ? values[i] / total : 1 / Math.max(1, stocks.length)
    }));
  }, [stocks]);

  const runBacktest = async () => {
    if (stocks.length === 0 || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/backtest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          holdings: weights,
          years,
          initialCapital,
          monthlyContribution,
          reinvestDividends: reinvest
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "백테스트에 실패했습니다.");
      setResult(data);
    } catch (e: any) {
      setError(e.message || "백테스트에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const chartData = useMemo(() => {
    if (!result) return [];
    return result.series.map(p => ({
      month: p.month,
      "실제 자산 (₩)": p.value,
      "누적 원금 (₩)": p.contributions
    }));
  }, [result]);

  return (
    <div className="space-y-6" id="backtest-panel">
      {/* Config panel */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs space-y-5">
        <div>
          <h3 className="font-semibold text-slate-800 text-lg flex items-center gap-1.5 font-display">
            <History className="w-5 h-5 text-indigo-600" />
            실데이터 백테스트 — "그때 시작했다면 지금 얼마?"
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            현재 포트폴리오 비중 그대로, 과거 실제 주가·배당·환율 데이터로 적립식 투자를 재현합니다. 가정이 아니라 실제 역사입니다.
          </p>
        </div>

        {stocks.length === 0 ? (
          <div className="text-center py-10 text-slate-400 text-sm">
            포트폴리오에 종목을 먼저 담아주세요. 담긴 비중대로 백테스트가 실행됩니다.
          </div>
        ) : (
          <>
            {/* Portfolio weights preview */}
            <div className="flex flex-wrap gap-2 text-[11px] font-mono">
              {weights.map(w => (
                <span key={w.ticker} className="bg-indigo-50 text-indigo-700 border border-indigo-100 px-2 py-1 rounded-lg font-bold">
                  {w.ticker} {(w.weight * 100).toFixed(0)}%
                </span>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              {/* Period */}
              <div className="space-y-2">
                <span className="text-xs text-slate-600 font-medium block">백테스트 기간</span>
                <div className="grid grid-cols-4 gap-1.5">
                  {[5, 10, 15, 20].map(y => (
                    <button
                      key={y}
                      onClick={() => setYears(y)}
                      className={`py-2 text-xs font-bold rounded-lg border transition ${
                        years === y ? "bg-indigo-600 border-indigo-600 text-white" : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                      }`}
                    >
                      {y}년
                    </button>
                  ))}
                </div>
              </div>

              {/* Initial capital */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-600 font-medium">시작 자본금</span>
                  <span className="text-indigo-600 font-bold">{formatCurrency(initialCapital)}</span>
                </div>
                <input
                  type="range" min="0" max="100000000" step="1000000"
                  value={initialCapital}
                  onChange={e => setInitialCapital(Number(e.target.value))}
                  className="w-full accent-indigo-600 h-1.5 bg-slate-100 rounded-lg cursor-pointer"
                />
              </div>

              {/* Monthly contribution */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-600 font-medium">월 적립액</span>
                  <span className="text-indigo-600 font-bold">{formatCurrency(monthlyContribution)}</span>
                </div>
                <input
                  type="range" min="0" max="5000000" step="100000"
                  value={monthlyContribution}
                  onChange={e => setMonthlyContribution(Number(e.target.value))}
                  className="w-full accent-indigo-600 h-1.5 bg-slate-100 rounded-lg cursor-pointer"
                />
              </div>

              {/* Reinvest + run */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-600 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={reinvest}
                    onChange={() => setReinvest(!reinvest)}
                    className="w-4 h-4 rounded text-indigo-600 border-slate-300"
                  />
                  배당 재투자 (DRIP)
                </label>
                <button
                  onClick={runBacktest}
                  disabled={loading}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                  {loading ? "과거 데이터 재현 중..." : "백테스트 실행"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-100 rounded-2xl p-5 text-center space-y-1">
          <AlertTriangle className="w-6 h-6 text-rose-500 mx-auto" />
          <p className="text-xs text-rose-600">{error}</p>
        </div>
      )}

      {/* Results */}
      {result && !loading && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-900 text-white rounded-2xl p-5 border border-slate-800">
              <span className="text-slate-400 text-xs font-semibold block">최종 자산 ({result.endMonth})</span>
              <span className="text-2xl font-bold mt-1 block">{formatCurrency(result.summary.finalValue)}</span>
              <span className={`text-[11px] font-mono font-bold mt-1 block ${result.summary.totalGain >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                원금 대비 {result.summary.totalReturnPct >= 0 ? "+" : ""}{(result.summary.totalReturnPct * 100).toFixed(1)}%
              </span>
            </div>
            <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-xs">
              <span className="text-slate-400 text-xs font-semibold block">총 납입 원금</span>
              <span className="text-2xl font-bold text-slate-800 mt-1 block">{formatCurrency(result.summary.totalContributions)}</span>
              <span className="text-slate-400 text-[11px] mt-1 block font-mono">{result.startMonth} ~ {result.endMonth}</span>
            </div>
            <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-xs">
              <span className="text-slate-400 text-xs font-semibold block">누적 세후 배당금</span>
              <span className="text-2xl font-bold text-indigo-600 mt-1 block">{formatCurrency(result.summary.totalNetDividends)}</span>
              <span className="text-indigo-500 text-[11px] mt-1 flex items-center gap-1">
                <Coins className="w-3.5 h-3.5" /> {reinvest ? "전액 재투자 반영" : "현금 보유 가정"}
              </span>
            </div>
            <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-xs">
              <span className="text-slate-400 text-xs font-semibold block">근사 연평균 성장률</span>
              <span className="text-2xl font-bold text-emerald-600 mt-1 block">{(result.summary.approxCagr * 100).toFixed(1)}%</span>
              <span className="text-slate-400 text-[11px] mt-1 block">실측 {result.summary.yearsActual}년 기준</span>
            </div>
          </div>

          {/* Chart */}
          <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs">
            <div className="pb-4 border-b border-slate-100 mb-6">
              <h3 className="font-semibold text-slate-800 text-lg flex items-center gap-1.5">
                <TrendingUp className="w-5 h-5 text-indigo-600" />
                실제 역사 재현 궤적
              </h3>
              <p className="text-xs text-slate-400">과거 실제 종가·배당·환율로 계산된 월별 자산 흐름입니다.</p>
            </div>
            <div className="h-80 w-full text-xs font-sans">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="btValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="month" stroke="#94a3b8" tickLine={false} minTickGap={40} />
                  <YAxis stroke="#94a3b8" tickLine={false} tickFormatter={(v) => `${(v / 10000).toLocaleString()}만`} />
                  <Tooltip
                    formatter={(value: any) => [formatCurrency(Number(value)), ""]}
                    contentStyle={{ backgroundColor: "#1e293b", borderColor: "#1e293b", borderRadius: "12px", color: "#f8fafc" }}
                  />
                  <Legend iconType="circle" />
                  <Area name="실제 자산 (배당 재투자 포함)" type="monotone" dataKey="실제 자산 (₩)" stroke="#4f46e5" strokeWidth={2.5} fill="url(#btValue)" />
                  <Area name="누적 납입 원금" type="monotone" dataKey="누적 원금 (₩)" stroke="#64748b" strokeWidth={1.5} strokeDasharray="4 4" fillOpacity={0} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Per-holding results + notes */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs space-y-3">
              <h4 className="font-semibold text-slate-800 text-sm flex items-center gap-1.5">
                <PiggyBank className="w-4 h-4 text-indigo-600" />
                종목별 최종 결과
              </h4>
              <div className="space-y-2">
                {result.holdings.map(h => (
                  <div key={h.ticker} className="flex items-center justify-between bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-xs font-mono">
                    <span className="font-bold text-slate-700">{h.ticker} <span className="text-slate-400">({(h.weight * 100).toFixed(0)}%)</span></span>
                    <span className="text-slate-600">{h.finalShares.toLocaleString()}주 · <strong className="text-indigo-600">{formatCurrency(h.finalValueKRW)}</strong></span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-amber-50/50 rounded-2xl border border-amber-100 p-6 space-y-2 text-xs text-amber-900">
              <h4 className="font-bold flex items-center gap-1.5">
                <Info className="w-4 h-4" />
                가정 및 참고
              </h4>
              <p className="leading-relaxed">{result.assumptions}</p>
              {result.notes.map((n, i) => (
                <p key={i} className="leading-relaxed">• {n}</p>
              ))}
              <p className="leading-relaxed text-amber-700">과거 성과는 미래 수익을 보장하지 않습니다.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
