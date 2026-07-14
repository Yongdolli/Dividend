import React, { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine
} from "recharts";
import { SimulationConfig } from "../types";
import {
  formatCurrency,
  calculateCompounding,
  solveRequiredMonthlyContribution,
  simulateRetirementPhase
} from "../utils";
import {
  Target,
  Wallet,
  CalendarClock,
  TrendingDown,
  Info,
  Sunrise
} from "lucide-react";

interface RetirementPlannerProps {
  config: SimulationConfig;
  portfolioYield: number;
  portfolioDividendGrowth: number;
  currentPortfolioValue: number; // 현재 포트폴리오 평가액 (KRW)
}

export default function RetirementPlanner({
  config,
  portfolioYield,
  portfolioDividendGrowth,
  currentPortfolioValue
}: RetirementPlannerProps) {
  const [targetNetMonthly, setTargetNetMonthly] = useState(3000000); // 세후 월 300만원
  const [yearsToRetire, setYearsToRetire] = useState(20);
  const [inflation, setInflation] = useState(0.02);

  const priceGrowth = config.stockPriceGrowthRate;

  // 시작 자본: 현재 포트폴리오 평가액이 있으면 그것을, 없으면 설정값 사용
  const startCapital = currentPortfolioValue > 0 ? currentPortfolioValue : config.initialCapital;
  const solverConfig = useMemo(
    () => ({ ...config, initialCapital: startCapital }),
    [config, startCapital]
  );

  // ① 목표 역산: 필요한 월 적립액
  const requiredMonthly = useMemo(() => {
    return solveRequiredMonthlyContribution(
      solverConfig, portfolioYield, portfolioDividendGrowth, priceGrowth,
      targetNetMonthly, yearsToRetire
    );
  }, [solverConfig, portfolioYield, portfolioDividendGrowth, priceGrowth, targetNetMonthly, yearsToRetire]);

  // ② 현재 설정(월 적립액)으로 가면 언제 달성?
  const yearsWithCurrentPlan = useMemo(() => {
    const sim = calculateCompounding(
      { ...solverConfig, years: 50 },
      portfolioYield, portfolioDividendGrowth, priceGrowth
    );
    const hit = sim.find(d => (d.annualDividends * (1 - config.dividendTaxRate)) / 12 >= targetNetMonthly);
    return hit ? hit.year : null;
  }, [solverConfig, portfolioYield, portfolioDividendGrowth, priceGrowth, targetNetMonthly, config.dividendTaxRate]);

  // ③ 은퇴 시점 자산 규모 (필요 적립액 기준) → 인출기 30년 시뮬레이션
  const retirementSim = useMemo(() => {
    const monthly = requiredMonthly ?? config.monthlyContribution;
    const sim = calculateCompounding(
      { ...solverConfig, monthlyContribution: monthly, years: yearsToRetire },
      portfolioYield, portfolioDividendGrowth, priceGrowth
    );
    const last = sim[sim.length - 1];
    // 은퇴 시점의 실효 수익률(배당/자산)로 인출기 시작
    const yieldAtRetirement = last.portfolioValue > 0 ? last.annualDividends / last.portfolioValue : portfolioYield;
    return {
      valueAtRetirement: last.portfolioValue,
      yieldAtRetirement,
      phase: simulateRetirementPhase(
        last.portfolioValue, yieldAtRetirement, portfolioDividendGrowth,
        priceGrowth, config.dividendTaxRate, 30, inflation
      )
    };
  }, [solverConfig, requiredMonthly, config.monthlyContribution, config.dividendTaxRate, yearsToRetire, portfolioYield, portfolioDividendGrowth, priceGrowth, inflation]);

  const withdrawalChartData = useMemo(() => {
    return retirementSim.phase.map(d => ({
      year: `+${d.year}년`,
      "세후 월배당 (₩)": d.netMonthlyDividend,
      "실질 구매력 (₩)": d.realNetMonthlyDividend
    }));
  }, [retirementSim]);

  return (
    <div className="space-y-6" id="retirement-planner">
      {/* Goal inputs */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs space-y-5">
        <div>
          <h3 className="font-semibold text-slate-800 text-lg flex items-center gap-1.5 font-display">
            <Target className="w-5 h-5 text-indigo-600" />
            배당 은퇴 설계 — 목표 역산 & 인출기 시뮬레이션
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            "세후 월 얼마"라는 목표에서 출발해 필요한 월 적립액을 역산하고, 은퇴 후 배당으로 사는 30년을 미리 봅니다.
            현재 포트폴리오(가중 배당수익률 {(portfolioYield * 100).toFixed(2)}%, 배당성장률 {(portfolioDividendGrowth * 100).toFixed(2)}%) 기준.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600 font-medium">목표 세후 월배당</span>
              <span className="text-indigo-600 font-bold">{formatCurrency(targetNetMonthly)}</span>
            </div>
            <input
              type="range" min="500000" max="10000000" step="100000"
              value={targetNetMonthly}
              onChange={e => setTargetNetMonthly(Number(e.target.value))}
              className="w-full accent-indigo-600 h-1.5 bg-slate-100 rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
              <span>50만원</span><span>1,000만원</span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600 font-medium">은퇴까지 남은 기간</span>
              <span className="text-indigo-600 font-bold">{yearsToRetire}년</span>
            </div>
            <input
              type="range" min="5" max="40" step="1"
              value={yearsToRetire}
              onChange={e => setYearsToRetire(Number(e.target.value))}
              className="w-full accent-indigo-600 h-1.5 bg-slate-100 rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
              <span>5년</span><span>40년</span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600 font-medium">물가상승률 가정</span>
              <span className="text-indigo-600 font-bold">{(inflation * 100).toFixed(1)}%</span>
            </div>
            <input
              type="range" min="0" max="5" step="0.5"
              value={inflation * 100}
              onChange={e => setInflation(Number(e.target.value) / 100)}
              className="w-full accent-indigo-600 h-1.5 bg-slate-100 rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
              <span>0%</span><span>5%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Answer cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-indigo-600 text-white rounded-2xl p-6 shadow-md shadow-indigo-100">
          <span className="text-indigo-200 text-xs font-semibold flex items-center gap-1.5">
            <Wallet className="w-4 h-4" /> 필요한 월 적립액
          </span>
          <span className="text-3xl font-extrabold mt-2 block font-sans">
            {requiredMonthly === null
              ? "달성 불가"
              : requiredMonthly === 0
                ? "추가 적립 불필요!"
                : `${formatCurrency(requiredMonthly)}`}
          </span>
          <p className="text-indigo-200 text-[11px] mt-2 leading-relaxed">
            {requiredMonthly === null
              ? "기간·목표를 조정하거나 배당성장률이 더 높은 포트폴리오가 필요합니다."
              : `현재 자산 ${formatCurrency(startCapital)}에서 시작해 ${yearsToRetire}년간 매월 이만큼 적립하면 목표에 도달합니다. (적립액 연 ${(config.contributionGrowthRate * 100).toFixed(0)}% 증액 가정)`}
          </p>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-xs">
          <span className="text-slate-400 text-xs font-semibold flex items-center gap-1.5">
            <CalendarClock className="w-4 h-4 text-indigo-600" /> 지금 계획대로면
          </span>
          <span className="text-3xl font-extrabold text-slate-800 mt-2 block font-sans">
            {yearsWithCurrentPlan === null ? "50년+" : `${yearsWithCurrentPlan}년 뒤`}
          </span>
          <p className="text-slate-400 text-[11px] mt-2 leading-relaxed">
            현재 설정된 월 적립액 {formatCurrency(config.monthlyContribution)} 기준으로 목표 월배당 도달까지 걸리는 시간입니다.
          </p>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-xs">
          <span className="text-slate-400 text-xs font-semibold flex items-center gap-1.5">
            <Sunrise className="w-4 h-4 text-amber-500" /> 은퇴 시점 예상 자산
          </span>
          <span className="text-3xl font-extrabold text-slate-800 mt-2 block font-sans">
            {formatCurrency(retirementSim.valueAtRetirement)}
          </span>
          <p className="text-slate-400 text-[11px] mt-2 leading-relaxed">
            실효 배당수익률 {(retirementSim.yieldAtRetirement * 100).toFixed(2)}% — 이 자산이 은퇴 후 매달 배당을 만들어냅니다.
          </p>
        </div>
      </div>

      {/* Withdrawal phase chart */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs">
        <div className="pb-4 border-b border-slate-100 mb-6">
          <h3 className="font-semibold text-slate-800 text-lg">은퇴 후 30년 — 배당으로 사는 인출기</h3>
          <p className="text-xs text-slate-400">
            적립을 멈추고 배당을 전액 생활비로 쓰는 기간입니다. 원금은 팔지 않으므로 자산과 배당이 계속 자랍니다.
            점선은 물가 {(inflation * 100).toFixed(1)}%를 반영한 실질 구매력입니다.
          </p>
        </div>
        <div className="h-80 w-full text-xs font-sans">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={withdrawalChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="rpNominal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="year" stroke="#94a3b8" tickLine={false} minTickGap={30} />
              <YAxis stroke="#94a3b8" tickLine={false} tickFormatter={(v) => `${(v / 10000).toLocaleString()}만`} />
              <Tooltip
                formatter={(value: any) => [formatCurrency(Number(value)), ""]}
                contentStyle={{ backgroundColor: "#1e293b", borderColor: "#1e293b", borderRadius: "12px", color: "#f8fafc" }}
              />
              <Legend iconType="circle" />
              <ReferenceLine y={targetNetMonthly} stroke="#f59e0b" strokeDasharray="6 3" label={{ value: "목표", fill: "#f59e0b", fontSize: 11 }} />
              <Area name="세후 월배당 (명목)" type="monotone" dataKey="세후 월배당 (₩)" stroke="#4f46e5" strokeWidth={2.5} fill="url(#rpNominal)" />
              <Area name="실질 구매력 (물가 반영)" type="monotone" dataKey="실질 구매력 (₩)" stroke="#10b981" strokeWidth={2} strokeDasharray="5 4" fillOpacity={0} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Assumptions */}
      <div className="bg-amber-50/50 rounded-2xl border border-amber-100 p-5 text-xs text-amber-900 space-y-1.5">
        <h4 className="font-bold flex items-center gap-1.5"><Info className="w-4 h-4" /> 계산 가정</h4>
        <p>• 적립기: 배당 100% 재투자(DRIP), 배당소득세 {(config.dividendTaxRate * 100).toFixed(1)}%, 주가상승률 연 {(priceGrowth * 100).toFixed(1)}% (복리 계산기 탭 설정과 공유)</p>
        <p>• 인출기: 신규 적립·재투자 없이 배당 전액 사용, 원금 미매도. 배당수익률은 배당성장률과 주가상승률의 상대비로 변화</p>
        <p>• 시뮬레이션은 가정 기반 참고 자료이며 실제 수익률·세제와 다를 수 있습니다</p>
      </div>
    </div>
  );
}
