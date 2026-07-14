import React, { useMemo } from "react";
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  BarChart, 
  Bar 
} from "recharts";
import { motion } from "motion/react";
import { SimulationConfig, SimulationYearlyData } from "../types";
import { formatCurrency, calculateCompounding } from "../utils";
import { 
  TrendingUp, 
  DollarSign, 
  Calendar, 
  Percent, 
  Coffee, 
  ShoppingBag, 
  Home, 
  Award,
  ChevronRight,
  Calculator
} from "lucide-react";

interface CompoundingSimulatorProps {
  config: SimulationConfig;
  setConfig: React.Dispatch<React.SetStateAction<SimulationConfig>>;
  portfolioYield: number;
  portfolioDividendGrowth: number;
  portfolioPriceGrowth: number;
}

export default function CompoundingSimulator({
  config,
  setConfig,
  portfolioYield,
  portfolioDividendGrowth,
  portfolioPriceGrowth
}: CompoundingSimulatorProps) {
  
  // Calculate simulation data whenever configs change
  const simulationData = useMemo(() => {
    return calculateCompounding(
      config,
      portfolioYield,
      portfolioDividendGrowth,
      portfolioPriceGrowth
    );
  }, [config, portfolioYield, portfolioDividendGrowth, portfolioPriceGrowth]);

  const finalYearData = simulationData[simulationData.length - 1] || {
    portfolioValue: 0,
    totalContributions: 0,
    annualDividends: 0,
    monthlyDividends: 0,
    totalDividendsReceived: 0,
    cumulativeDividendsReinvested: 0
  };

  const totalDividendsReceived = finalYearData.totalDividendsReceived;

  // Milestone check
  const milestones = [
    { 
      id: "coffee", 
      target: 50000, 
      label: "스타벅스 커피값 해결", 
      desc: "매달 약 10잔의 커피를 배당금으로 마십니다.", 
      icon: Coffee, 
      color: "bg-emerald-50 text-emerald-600 border-emerald-100" 
    },
    { 
      id: "grocery", 
      target: 300000, 
      label: "마트 장보기 비용 해결", 
      desc: "매달 신선한 식재료와 장보기를 공짜로 해결합니다.", 
      icon: ShoppingBag, 
      color: "bg-blue-50 text-blue-600 border-blue-100" 
    },
    { 
      id: "rent", 
      target: 1000000, 
      label: "고정 월세 & 생활비 해결", 
      desc: "주거 비용 및 고정 생활비로부터 온전한 자유를 얻기 시작합니다.", 
      icon: Home, 
      color: "bg-indigo-50 text-indigo-600 border-indigo-100" 
    },
    { 
      id: "freedom", 
      target: 3000000, 
      label: "배당 완전 자립 (FIRE!)", 
      desc: "근로 소득 없이도 안정적인 일상을 영위하는 온전한 경제적 독립 단계입니다.", 
      icon: Award, 
      color: "bg-amber-50 text-amber-600 border-amber-100" 
    }
  ];

  // Helper to find in which year a milestone is reached
  function getMilestoneYear(targetMonthly: number): string {
    const reachedIdx = simulationData.findIndex(d => d.monthlyDividends >= targetMonthly);
    if (reachedIdx === -1) {
      return "시뮬레이션 기간 초과 (증액이 필요합니다)";
    }
    return `투자 ${simulationData[reachedIdx].year}년차 달성`;
  }

  // Format chart values
  const formatChartValue = (value: number) => {
    return `${(value / 10000).toLocaleString()}만원`;
  };

  const chartData = useMemo(() => {
    return simulationData.map(d => ({
      year: `${d.year}년`,
      "총 자산 (₩)": d.portfolioValue,
      "원금 합계 (₩)": d.totalContributions,
      "연간 배당금 (₩)": d.annualDividends,
      "월간 배당금 (₩)": d.monthlyDividends
    }));
  }, [simulationData]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8" id="compounding-simulator">
      {/* Simulation Configuration Panel */}
      <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-100 p-6 shadow-xs space-y-6">
        <div className="flex items-center space-x-2 pb-2 border-b border-slate-100">
          <Calculator className="w-5 h-5 text-indigo-600" />
          <h3 className="font-semibold text-slate-800 text-lg">시뮬레이션 환경 변수</h3>
        </div>

        {/* Initial Capital */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-sm">
            <span className="text-slate-600 font-medium">초기 자본금</span>
            <span className="text-indigo-600 font-bold">{formatCurrency(config.initialCapital)}</span>
          </div>
          <input 
            type="range" 
            min="1000000" 
            max="100000000" 
            step="1000000"
            value={config.initialCapital}
            onChange={(e) => setConfig(prev => ({ ...prev, initialCapital: Number(e.target.value) }))}
            className="w-full accent-indigo-600 h-1.5 bg-slate-100 rounded-lg cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-400 font-mono">
            <span>100만원</span>
            <span>1억원</span>
          </div>
        </div>

        {/* Monthly Contribution */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-sm">
            <span className="text-slate-600 font-medium">월 정기 추가 적립식 투자</span>
            <span className="text-indigo-600 font-bold">{formatCurrency(config.monthlyContribution)} / 월</span>
          </div>
          <input 
            type="range" 
            min="0" 
            max="5000000" 
            step="100000"
            value={config.monthlyContribution}
            onChange={(e) => setConfig(prev => ({ ...prev, monthlyContribution: Number(e.target.value) }))}
            className="w-full accent-indigo-600 h-1.5 bg-slate-100 rounded-lg cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-400 font-mono">
            <span>0원 (거치식)</span>
            <span>500만원</span>
          </div>
        </div>

        {/* Monthly Contribution Growth Rate */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-sm">
            <span className="text-slate-600 font-medium">적립금 연 성장률</span>
            <span className="text-indigo-600 font-bold">{(config.contributionGrowthRate * 100).toFixed(1)}%</span>
          </div>
          <input 
            type="range" 
            min="0" 
            max="15" 
            step="0.5"
            value={config.contributionGrowthRate * 100}
            onChange={(e) => setConfig(prev => ({ ...prev, contributionGrowthRate: Number(e.target.value) / 100 }))}
            className="w-full accent-indigo-600 h-1.5 bg-slate-100 rounded-lg cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-400 font-mono">
            <span>0%</span>
            <span>15%</span>
          </div>
        </div>

        {/* Reinvestment Strategy Selector */}
        <div className="space-y-3">
          <span className="text-sm text-slate-600 font-medium block">배당 재투자 전략</span>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => setConfig(prev => ({ ...prev, reinvestmentStrategy: "DRIP" }))}
              className={`py-2.5 text-xs font-semibold rounded-xl border transition-all ${
                config.reinvestmentStrategy === "DRIP" 
                  ? "bg-indigo-600 border-indigo-600 text-white shadow-sm" 
                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              100% 재투자 (DRIP)
            </button>
            <button
              onClick={() => setConfig(prev => ({ ...prev, reinvestmentStrategy: "Manual" }))}
              className={`py-2.5 text-xs font-semibold rounded-xl border transition-all ${
                config.reinvestmentStrategy === "Manual" 
                  ? "bg-indigo-600 border-indigo-600 text-white shadow-sm" 
                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              일부 재투자
            </button>
            <button
              onClick={() => setConfig(prev => ({ ...prev, reinvestmentStrategy: "None" }))}
              className={`py-2.5 text-xs font-semibold rounded-xl border transition-all ${
                config.reinvestmentStrategy === "None" 
                  ? "bg-indigo-600 border-indigo-600 text-white shadow-sm" 
                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              재투자 없음 (용돈)
            </button>
          </div>
          
          {config.reinvestmentStrategy === "Manual" && (
            <div className="space-y-2 pt-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
              <div className="flex justify-between text-xs">
                <span className="text-slate-500 font-medium">재투자 비율</span>
                <span className="text-indigo-600 font-bold">{(config.reinvestRate * 100).toFixed(0)}%</span>
              </div>
              <input 
                type="range" 
                min="10" 
                max="90" 
                step="5"
                value={config.reinvestRate * 100}
                onChange={(e) => setConfig(prev => ({ ...prev, reinvestRate: Number(e.target.value) / 100 }))}
                className="w-full accent-indigo-600 h-1 bg-indigo-200 rounded-lg cursor-pointer"
              />
            </div>
          )}
        </div>

        {/* Tax Rate */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-sm">
            <span className="text-slate-600 font-medium">배당 소득세율</span>
            <span className="text-indigo-600 font-bold">{(config.dividendTaxRate * 100).toFixed(1)}%</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "일반 계좌 (15.4%)", val: 0.154 },
              { label: "ISA/절세 (9.9%)", val: 0.099 },
              { label: "비과세 (0.0%)", val: 0 }
            ].map(taxOption => (
              <button
                key={taxOption.label}
                onClick={() => setConfig(prev => ({ ...prev, dividendTaxRate: taxOption.val }))}
                className={`py-1.5 text-[11px] rounded-lg border font-medium ${
                  config.dividendTaxRate === taxOption.val
                    ? "bg-slate-800 border-slate-800 text-white"
                    : "border-slate-200 text-slate-500 hover:bg-slate-50"
                }`}
              >
                {taxOption.label}
              </button>
            ))}
          </div>
        </div>

        {/* Duration */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-sm">
            <span className="text-slate-600 font-medium">시뮬레이션 기간</span>
            <span className="text-indigo-600 font-bold">{config.years}년</span>
          </div>
          <input 
            type="range" 
            min="5" 
            max="40" 
            step="1"
            value={config.years}
            onChange={(e) => setConfig(prev => ({ ...prev, years: Number(e.target.value) }))}
            className="w-full accent-indigo-600 h-1.5 bg-slate-100 rounded-lg cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-400 font-mono">
            <span>5년</span>
            <span>40년</span>
          </div>
        </div>

        {/* Advanced Assumptions Information */}
        <div className="bg-amber-50/50 rounded-xl p-3 border border-amber-100 text-xs text-amber-800 space-y-1">
          <p className="font-semibold flex items-center gap-1">
            <Percent className="w-3.5 h-3.5" /> 포트폴리오 가중 평균 가정
          </p>
          <div className="grid grid-cols-2 gap-2 pt-1 font-mono text-[11px]">
            <div>• 가중 배당수익률: <span className="font-bold text-slate-700">{(portfolioYield * 100).toFixed(2)}%</span></div>
            <div>• 연 배당성장률: <span className="font-bold text-slate-700">{(portfolioDividendGrowth * 100).toFixed(2)}%</span></div>
            <div className="col-span-2">• 연 주가상승률: <span className="font-bold text-slate-700">{(portfolioPriceGrowth * 100).toFixed(2)}%</span></div>
          </div>
        </div>
      </div>

      {/* Main Results Panel */}
      <div className="lg:col-span-8 space-y-6">
        {/* Aggregated KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="bg-white rounded-2xl p-5 border border-slate-100 shadow-xs"
          >
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider block">최종 예상 총자산 ({config.years}년차)</span>
            <div className="flex items-baseline space-x-1 mt-1">
              <span className="text-2xl font-bold text-slate-900">{formatCurrency(finalYearData.portfolioValue)}</span>
            </div>
            <span className="text-emerald-600 text-xs font-medium flex items-center gap-1 mt-2">
              <TrendingUp className="w-3.5 h-3.5" /> 원금 대비 {((finalYearData.portfolioValue / Math.max(1, finalYearData.totalContributions)) * 100).toFixed(0)}% 성장
            </span>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="bg-white rounded-2xl p-5 border border-slate-100 shadow-xs"
          >
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider block">월 평균 배당수령액 ({config.years}년차)</span>
            <div className="flex items-baseline space-x-1 mt-1">
              <span className="text-2xl font-bold text-indigo-600">{formatCurrency(finalYearData.monthlyDividends)}</span>
              <span className="text-xs text-slate-500 font-semibold">/ 월</span>
            </div>
            <span className="text-slate-500 text-xs mt-2 block font-mono">
              연간 세전 {formatCurrency(finalYearData.annualDividends)}
            </span>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
            className="bg-white rounded-2xl p-5 border border-slate-100 shadow-xs"
          >
            <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider block">누적 세후 배당금 총액</span>
            <div className="flex items-baseline space-x-1 mt-1">
              <span className="text-2xl font-bold text-slate-800">{formatCurrency(totalDividendsReceived)}</span>
            </div>
            <span className="text-indigo-500 text-xs font-medium mt-2 block">
              누적 재투자액: {formatCurrency(finalYearData.cumulativeDividendsReinvested)}
            </span>
          </motion.div>
        </div>

        {/* Compounding Visual Graph */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100 mb-6">
            <div>
              <h3 className="font-semibold text-slate-800 text-lg">복리 성장 시뮬레이션 궤적</h3>
              <p className="text-xs text-slate-400">배당 재투자와 매월 꾸준한 납입이 만드는 기하급수적 원금 격차</p>
            </div>
          </div>
          
          <div className="h-80 w-full font-sans text-xs">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorContrib" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#64748b" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#64748b" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="year" stroke="#94a3b8" tickLine={false} />
                <YAxis 
                  stroke="#94a3b8" 
                  tickLine={false} 
                  tickFormatter={formatChartValue}
                />
                <Tooltip 
                  formatter={(value: any) => [formatCurrency(Number(value)), ""]}
                  contentStyle={{ backgroundColor: "#1e293b", borderColor: "#1e293b", borderRadius: "12px", color: "#f8fafc" }}
                />
                <Legend iconType="circle" />
                <Area 
                  name="총 평가자산 (배당+원금)" 
                  type="monotone" 
                  dataKey="총 자산 (₩)" 
                  stroke="#4f46e5" 
                  strokeWidth={2.5}
                  fillOpacity={1} 
                  fill="url(#colorValue)" 
                />
                <Area 
                  name="누적 원금 합계" 
                  type="monotone" 
                  dataKey="원금 합계 (₩)" 
                  stroke="#64748b" 
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  fillOpacity={1} 
                  fill="url(#colorContrib)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Milestone Achievement Track */}
        <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs">
          <h3 className="font-semibold text-slate-800 text-lg mb-1">배당 자립 마일스톤</h3>
          <p className="text-xs text-slate-400 mb-6">배당금이 생활비를 책임지는 '배당 자립의 기쁨'을 연도별로 예측합니다.</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {milestones.map((milestone) => {
              const IconComp = milestone.icon;
              const whenYear = getMilestoneYear(milestone.target);
              const isAchieved = !whenYear.includes("초과");
              
              return (
                <div 
                  key={milestone.id} 
                  className={`flex items-start gap-4 p-4 rounded-xl border transition-all ${
                    isAchieved 
                      ? "bg-slate-50 border-slate-100 hover:border-indigo-100" 
                      : "bg-slate-50/40 border-slate-100/60 opacity-60"
                  }`}
                >
                  <div className={`p-3 rounded-xl border ${milestone.color}`}>
                    <IconComp className="w-5 h-5" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-slate-800 text-sm">{milestone.label}</h4>
                      <span className="text-[11px] font-medium text-indigo-600 font-mono bg-indigo-50 border border-indigo-100/50 px-2 py-0.5 rounded-md">
                        월 {formatCurrency(milestone.target)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">{milestone.desc}</p>
                    <div className="flex items-center text-xs text-slate-600 font-semibold pt-1">
                      <span>{whenYear}</span>
                      {isAchieved && <ChevronRight className="w-3.5 h-3.5 text-slate-400 ml-0.5" />}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
