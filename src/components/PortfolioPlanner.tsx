import React, { useMemo, useState } from "react";
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Cell 
} from "recharts";
import { Stock } from "../types";
import {
  formatCurrency,
  calculatePortfolioMetrics,
  calculatePayoutCalendar,
  toKRW,
  getFxRate
} from "../utils";
import {
  Briefcase,
  Plus,
  Trash2,
  Coins,
  TrendingUp,
  Clock,
  Settings,
  AlertCircle,
  RefreshCw
} from "lucide-react";
import DividendRecommendations from "./DividendRecommendations";
import PortfolioShareAndMilestones from "./PortfolioShareAndMilestones";

interface PortfolioPlannerProps {
  stocks: Stock[];
  setStocks: React.Dispatch<React.SetStateAction<Stock[]>>;
  onRefreshQuotes: () => Promise<void>;
  isRefreshingQuotes: boolean;
  lastQuoteSync: string | null;
}

export default function PortfolioPlanner({ stocks, setStocks, onRefreshQuotes, isRefreshingQuotes, lastQuoteSync }: PortfolioPlannerProps) {
  const existingTickers = useMemo(() => {
    return stocks.map(s => s.ticker.toUpperCase());
  }, [stocks]);

  const handleAddRecommendedStock = (recommended: Stock) => {
    const exists = stocks.some(s => s.ticker.toUpperCase() === recommended.ticker.toUpperCase());
    if (exists) return;
    setStocks(prev => [...prev, recommended]);
  };

  const handleAddMultipleStocks = (recommendedList: Stock[]) => {
    setStocks(prev => {
      const filteredNew = recommendedList.filter(newStock => 
        !prev.some(existing => existing.ticker.toUpperCase() === newStock.ticker.toUpperCase())
      );
      if (filteredNew.length === 0) return prev;
      return [...prev, ...filteredNew];
    });
  };
  const [showAddForm, setShowAddForm] = useState(false);
  const [newStock, setNewStock] = useState({
    ticker: "",
    name: "",
    currentPrice: "",
    currency: "USD",
    dividendYield: "",
    dividendGrowthRate: "",
    payoutFrequency: "Quarterly" as Stock["payoutFrequency"],
    sharesOwned: ""
  });

  // Calculate weighted average metrics
  const { totalValueKRW, totalAnnualDividendKRW, weightedYield, weightedGrowthRate, weightedTaxRate } = useMemo(() => {
    return calculatePortfolioMetrics(stocks);
  }, [stocks]);

  // Calculate monthly payout calendar
  const monthlyCalendar = useMemo(() => {
    return calculatePayoutCalendar(stocks);
  }, [stocks]);

  // Total shares sum
  const totalSharesCount = useMemo(() => {
    return stocks.reduce((acc, stock) => acc + stock.sharesOwned, 0);
  }, [stocks]);

  const handleShareChange = (id: string, value: number) => {
    setStocks(prev => prev.map(stock => {
      if (stock.id === id) {
        return { ...stock, sharesOwned: Math.max(0, value) };
      }
      return stock;
    }));
  };

  const handleDeleteStock = (id: string) => {
    setStocks(prev => prev.filter(stock => stock.id !== id));
  };

  const handleAddCustomStock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStock.ticker || !newStock.name || !newStock.currentPrice || !newStock.dividendYield) {
      alert("모든 필드를 입력해주세요.");
      return;
    }

    const price = parseFloat(newStock.currentPrice);
    const divYield = parseFloat(newStock.dividendYield) / 100;
    const growth = parseFloat(newStock.dividendGrowthRate || "0") / 100;
    const shares = parseFloat(newStock.sharesOwned || "0");

    const customStock: Stock = {
      id: `custom-${Date.now()}`,
      ticker: newStock.ticker.toUpperCase(),
      name: newStock.name,
      currentPrice: price,
      currency: newStock.currency,
      dividendYield: divYield,
      payoutRatio: 0.5, // default
      dividendGrowthRate: growth,
      payoutFrequency: newStock.payoutFrequency,
      growthStreak: 0,
      safetyScore: 70,
      safetyReason: "사용자가 수동으로 추가한 종목입니다.",
      analysis: `${newStock.name}은(는) 직접 구성한 배당 포트폴리오 종목입니다.`,
      pros: ["직접 작성한 우량 배당 분석 기준 적용"],
      cons: ["주기적인 공시 및 재무제표 업데이트 관찰 필요"],
      sharesOwned: shares
    };

    setStocks(prev => [...prev, customStock]);
    setShowAddForm(false);
    setNewStock({
      ticker: "",
      name: "",
      currentPrice: "",
      currency: "USD",
      dividendYield: "",
      dividendGrowthRate: "",
      payoutFrequency: "Quarterly",
      sharesOwned: ""
    });
  };

  // Prepare calendar chart data
  const calendarChartData = useMemo(() => {
    const monthNames = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];
    return monthlyCalendar.map((amount, idx) => ({
      month: monthNames[idx],
      "배당금 (₩)": amount
    }));
  }, [monthlyCalendar]);

  const activeMonthCount = useMemo(() => {
    return monthlyCalendar.filter(amt => amt > 0).length;
  }, [monthlyCalendar]);

  return (
    <div className="space-y-8" id="portfolio-planner">
      {/* Portfolio Overview Aggregated Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-xs border border-slate-800">
          <span className="text-slate-400 text-xs font-semibold block">총 포트폴리오 평가액</span>
          <span className="text-2xl font-bold mt-1 block font-sans">{formatCurrency(totalValueKRW)}</span>
          <span className="text-slate-400 text-[11px] mt-1 block font-mono">
            {stocks.filter(s => s.currency === "USD").length > 0 && `(실시간 환율 ₩${Math.round(getFxRate("USD")).toLocaleString()}/$ 적용)`}
          </span>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-xs">
          <span className="text-slate-400 text-xs font-semibold block">연간 배당금 총액 (세전)</span>
          <span className="text-2xl font-bold text-slate-800 mt-1 block font-sans">{formatCurrency(totalAnnualDividendKRW)}</span>
          <span className="text-indigo-600 text-xs font-semibold mt-1 flex items-center gap-1">
            <Coins className="w-3.5 h-3.5" /> 세후 월평균 {formatCurrency((totalAnnualDividendKRW * (1 - weightedTaxRate)) / 12)} (원천징수 {(weightedTaxRate * 100).toFixed(1)}%)
          </span>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-xs">
          <span className="text-slate-400 text-xs font-semibold block">평균 가중 배당수익률</span>
          <span className="text-2xl font-bold text-indigo-600 mt-1 block font-sans">{(weightedYield * 100).toFixed(2)}%</span>
          <span className="text-slate-500 text-xs mt-1 block">
            전체 자산 대비 배당 생산성
          </span>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-xs">
          <span className="text-slate-400 text-xs font-semibold block">가중 배당 성장률 (5Y)</span>
          <span className="text-2xl font-bold text-slate-800 mt-1 block font-sans">{(weightedGrowthRate * 100).toFixed(2)}%</span>
          <span className="text-emerald-600 text-xs font-semibold mt-1 flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5" /> 물가상승률 방어 우수
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Dividend Stocks Asset Manager List */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-100 p-6 shadow-xs space-y-6">
          <div className="flex justify-between items-center pb-4 border-b border-slate-100 gap-2 flex-wrap">
            <div>
              <h3 className="font-semibold text-slate-800 text-lg">자산 현황 및 수량 관리</h3>
              <p className="text-xs text-slate-400">
                보유 수량을 조절하여 최적의 연간 배당 현금흐름을 연출해보세요.
                {lastQuoteSync && <span className="block text-[10px] text-slate-400 font-mono mt-0.5">시세 업데이트: {lastQuoteSync}</span>}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onRefreshQuotes()}
                disabled={isRefreshingQuotes || stocks.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-indigo-100 bg-white hover:bg-indigo-50/50 text-indigo-600 rounded-lg text-xs font-semibold transition disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingQuotes ? "animate-spin" : ""}`} />
                {isRefreshingQuotes ? "시세 조회 중..." : "실시간 시세 새로고침"}
              </button>
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 transition"
              >
                <Plus className="w-3.5 h-3.5" /> 수동 추가
              </button>
            </div>
          </div>

          {/* Collapsible Custom Asset Add Form */}
          {showAddForm && (
            <form onSubmit={handleAddCustomStock} className="bg-slate-50 border border-slate-100 rounded-xl p-4 space-y-3">
              <h4 className="text-xs font-bold text-slate-700">새로운 종목 직접 추가</h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500">티커 / 종목코드</label>
                  <input
                    type="text"
                    required
                    placeholder="예: MSFT, O"
                    value={newStock.ticker}
                    onChange={(e) => setNewStock(prev => ({ ...prev, ticker: e.target.value }))}
                    className="w-full text-xs border border-slate-200 rounded-md p-1.5 bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500">종목 한글명</label>
                  <input
                    type="text"
                    required
                    placeholder="예: 마이크로소프트"
                    value={newStock.name}
                    onChange={(e) => setNewStock(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full text-xs border border-slate-200 rounded-md p-1.5 bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500">현재 주가</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="예: 420.5"
                    value={newStock.currentPrice}
                    onChange={(e) => setNewStock(prev => ({ ...prev, currentPrice: e.target.value }))}
                    className="w-full text-xs border border-slate-200 rounded-md p-1.5 bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500">통화 기준</label>
                  <select
                    value={newStock.currency}
                    onChange={(e) => setNewStock(prev => ({ ...prev, currency: e.target.value }))}
                    className="w-full text-xs border border-slate-200 rounded-md p-1.5 bg-white"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="KRW">KRW (₩)</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500">연 배당수익률 (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="예: 3.5"
                    value={newStock.dividendYield}
                    onChange={(e) => setNewStock(prev => ({ ...prev, dividendYield: e.target.value }))}
                    className="w-full text-xs border border-slate-200 rounded-md p-1.5 bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500">예상 배당성장률 (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="예: 5.5"
                    value={newStock.dividendGrowthRate}
                    onChange={(e) => setNewStock(prev => ({ ...prev, dividendGrowthRate: e.target.value }))}
                    className="w-full text-xs border border-slate-200 rounded-md p-1.5 bg-white"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500">배당 지급 주기</label>
                  <select
                    value={newStock.payoutFrequency}
                    onChange={(e) => setNewStock(prev => ({ ...prev, payoutFrequency: e.target.value as Stock["payoutFrequency"] }))}
                    className="w-full text-xs border border-slate-200 rounded-md p-1.5 bg-white"
                  >
                    <option value="Monthly">월배당</option>
                    <option value="Quarterly">분기배당</option>
                    <option value="Semi-Annually">반기배당</option>
                    <option value="Annually">연배당</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500">보유 수량 (주)</label>
                  <input
                    type="number"
                    placeholder="예: 50"
                    value={newStock.sharesOwned}
                    onChange={(e) => setNewStock(prev => ({ ...prev, sharesOwned: e.target.value }))}
                    className="w-full text-xs border border-slate-200 rounded-md p-1.5 bg-white"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-100 rounded-md"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 text-xs bg-slate-800 text-white rounded-md hover:bg-slate-950"
                >
                  종목 저장
                </button>
              </div>
            </form>
          )}

          <div className="space-y-4 max-h-[420px] overflow-y-auto pr-1">
            {stocks.length === 0 ? (
              <div className="text-center py-12 text-slate-400 space-y-2">
                <Briefcase className="w-8 h-8 mx-auto opacity-40" />
                <p className="text-sm">포트폴리오가 비어 있습니다. AI 종목 검색이나 수동 추가를 진행해 보세요!</p>
              </div>
            ) : (
              stocks.map((stock) => {
                const isUSD = stock.currency === "USD";
                const priceFormatted = isUSD ? `$${stock.currentPrice.toLocaleString()}` : `${stock.currentPrice.toLocaleString()}원`;
                const valueKRW = stock.sharesOwned * toKRW(stock.currentPrice, stock.currency);
                const weight = totalValueKRW > 0 ? (valueKRW / totalValueKRW) * 100 : 0;
                
                return (
                  <div 
                    key={stock.id} 
                    className="border border-slate-100 rounded-xl p-4 hover:bg-slate-50/50 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-indigo-600 text-xs font-mono bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md">
                          {stock.ticker}
                        </span>
                        <h4 className="font-semibold text-slate-800 text-sm line-clamp-1">{stock.name}</h4>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 font-medium">
                        <span>현재가: <strong className="text-slate-700">{priceFormatted}</strong></span>
                        <span>배당률: <strong className="text-indigo-600">{(stock.dividendYield * 100).toFixed(2)}%</strong></span>
                        <span>지급 주기: <strong className="text-slate-600">{stock.payoutFrequency === "Monthly" ? "매월" : stock.payoutFrequency === "Quarterly" ? "분기" : stock.payoutFrequency === "Semi-Annually" ? "반기" : "매년"}</strong></span>
                      </div>
                    </div>

                    <div className="flex items-center gap-6 w-full sm:w-auto justify-between sm:justify-end">
                      {/* Weight badge */}
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 font-bold block uppercase">비중</span>
                        <span className="text-xs font-bold text-slate-700 font-mono">{weight.toFixed(1)}%</span>
                      </div>

                      {/* Shares input counter */}
                      <div className="flex items-center space-x-1.5">
                        <button
                          onClick={() => handleShareChange(stock.id, stock.sharesOwned - 10)}
                          className="w-7 h-7 flex items-center justify-center border border-slate-200 text-slate-500 hover:bg-slate-100 rounded-lg text-xs font-bold transition"
                        >
                          -10
                        </button>
                        <input
                          type="number"
                          value={stock.sharesOwned}
                          onChange={(e) => handleShareChange(stock.id, Math.max(0, parseInt(e.target.value) || 0))}
                          className="w-16 h-7 text-center text-xs font-bold border border-slate-200 rounded-lg"
                        />
                        <button
                          onClick={() => handleShareChange(stock.id, stock.sharesOwned + 10)}
                          className="w-7 h-7 flex items-center justify-center border border-slate-200 text-slate-500 hover:bg-slate-100 rounded-lg text-xs font-bold transition"
                        >
                          +10
                        </button>
                      </div>

                      {/* Delete button */}
                      <button
                        onClick={() => handleDeleteStock(stock.id)}
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Monthly Dividend Payout Calendar (Visualized) */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-100 p-6 shadow-xs flex flex-col justify-between">
          <div className="space-y-1 pb-4 border-b border-slate-100 mb-6">
            <h3 className="font-semibold text-slate-800 text-lg">월별 배당 수령 캘린더</h3>
            <p className="text-xs text-slate-400">연중 배당 분산을 계획하여 제2의 매월 연금 월급날을 완성합니다.</p>
          </div>

          <div className="h-64 w-full text-xs font-mono mb-4">
            {totalSharesCount === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400 flex-col space-y-2">
                <Clock className="w-8 h-8 opacity-40" />
                <p className="text-xs">보유 수량이 등록되면 월별 예측 달력이 그려집니다.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={calendarChartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="month" stroke="#94a3b8" tickLine={false} />
                  <YAxis stroke="#94a3b8" tickLine={false} tickFormatter={(v) => `${(v / 10000).toLocaleString()}만`} />
                  <Tooltip 
                    formatter={(value: any) => [formatCurrency(Number(value)), "수령액"]}
                    contentStyle={{ backgroundColor: "#1e293b", borderColor: "#1e293b", borderRadius: "10px", color: "#f8fafc" }}
                  />
                  <Bar dataKey="배당금 (₩)" fill="#4f46e5" radius={[4, 4, 0, 0]}>
                    {calendarChartData.map((entry, index) => {
                      const value = entry["배당금 (₩)"];
                      return <Cell key={`cell-${index}`} fill={value > 0 ? "#4f46e5" : "#cbd5e1"} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 space-y-2 text-xs text-indigo-950 mt-auto">
            <div className="flex items-center space-x-1.5 font-bold">
              <AlertCircle className="w-4 h-4 text-indigo-600" />
              <span>포트폴리오 균형 분석</span>
            </div>
            <p className="text-[11px] leading-relaxed text-indigo-900/90">
              현재 포트폴리오는 1년 중 <strong>{activeMonthCount}개월</strong> 동안 배당이 균등하게 지급되는 형태입니다. 
              {activeMonthCount < 12 ? (
                <span> '월배당' 주식(예: Realty Income)을 적절히 배합하거나 다른 분기 주기를 가진 자산을 배분하면 매월 더 규칙적인 배당 수령 구조를 만들 수 있습니다.</span>
              ) : (
                <span> 모든 달에 월급처럼 현금흐름이 꼬박꼬박 지급되는 아름다운 연금형 포트폴리오가 완성되었습니다!</span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* AI Recommended Rankings & Scoring Board */}
      <DividendRecommendations 
        onAddStock={handleAddRecommendedStock} 
        onAddMultipleStocks={handleAddMultipleStocks}
        existingTickers={existingTickers} 
      />

      {/* Portfolio Share & Lifestyle Milestones Challenger */}
      <PortfolioShareAndMilestones stocks={stocks} />

      {/* Portfolio Yield-vs-Growth Quadrant Matrix Analyzer */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 shadow-xs space-y-6 animate-in fade-in slide-in-from-bottom-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <h3 className="font-semibold text-slate-800 text-lg flex items-center gap-1.5 font-display">
              <TrendingUp className="w-5 h-5 text-indigo-600" />
              배당 수익률 vs 배당 성장률 포트폴리오 균형 매트릭스
            </h3>
            <p className="text-xs text-slate-400">
              배당주의 핵심 가치인 '현재의 높은 배당(수익률)'과 '미래의 늘어나는 배당(성장률)'의 분산 상태를 진단합니다.
            </p>
          </div>
          <div className="flex gap-4 text-xs font-mono">
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
              <span className="text-slate-500">기준 배당수익률: <strong className="text-slate-700">4.0%</strong></span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
              <span className="text-slate-500">기준 배당성장률: <strong className="text-slate-700">5.0%</strong></span>
            </div>
          </div>
        </div>

        {stocks.length === 0 ? (
          <div className="text-center py-10 text-slate-400 text-xs">
            종목이 등록되면 자동으로 포트폴리오의 수익/성장 밸런싱 분석 리포트가 생성됩니다.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Quadrant 1: Sweet Spot (고배당 & 고성장) */}
            <div className="border border-emerald-100 bg-emerald-50/20 rounded-2xl p-5 space-y-4">
              <div className="flex justify-between items-start">
                <div className="space-y-0.5">
                  <span className="text-xs font-extrabold text-emerald-700 uppercase tracking-wider block">Quadrant A • 배당 엘리트 (Sweet Spot)</span>
                  <h4 className="font-bold text-slate-800 text-sm">고배당 & 고성장 자산</h4>
                </div>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                  {stocks.filter(s => s.dividendYield >= 0.04 && s.dividendGrowthRate >= 0.05).length}개 종목
                </span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                현재 4% 이상의 높은 배당을 주면서, 매년 5% 이상의 빠른 성장 속도로 배당을 인상하는 가장 이상적인 코어 자산입니다. 복리 재투자의 시너지가 극대화됩니다.
              </p>
              
              <div className="space-y-2">
                {stocks.filter(s => s.dividendYield >= 0.04 && s.dividendGrowthRate >= 0.05).map(s => (
                  <div key={s.id} className="flex items-center justify-between bg-white px-3 py-2 rounded-xl border border-slate-100 text-xs font-mono">
                    <span className="font-bold text-slate-700">{s.name} ({s.ticker})</span>
                    <span className="text-emerald-600 font-bold">Yield {(s.dividendYield * 100).toFixed(1)}% / Growth {(s.dividendGrowthRate * 100).toFixed(1)}%</span>
                  </div>
                ))}
                {stocks.filter(s => s.dividendYield >= 0.04 && s.dividendGrowthRate >= 0.05).length === 0 && (
                  <div className="text-slate-400 text-[11px] text-center py-2 bg-white/50 rounded-xl border border-dashed border-slate-200">
                    해당되는 자산이 없습니다.
                  </div>
                )}
              </div>
            </div>

            {/* Quadrant 2: Income Focus (고배당 & 저성장) */}
            <div className="border border-blue-100 bg-blue-50/20 rounded-2xl p-5 space-y-4">
              <div className="flex justify-between items-start">
                <div className="space-y-0.5">
                  <span className="text-xs font-extrabold text-blue-700 uppercase tracking-wider block">Quadrant B • 현재 현금흐름 (Income Focus)</span>
                  <h4 className="font-bold text-slate-800 text-sm">고배당 & 저성장 자산</h4>
                </div>
                <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded-full">
                  {stocks.filter(s => s.dividendYield >= 0.04 && s.dividendGrowthRate < 0.05).length}개 종목
                </span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                배당률이 높으나 배당 성장 속도는 상대적으로 느립니다. 즉각적인 월세 소득이나 은퇴 기 현금흐름 확보에 아주 요긴하지만, 장기 인플레이션 방어에는 취약할 수 있습니다.
              </p>
              
              <div className="space-y-2">
                {stocks.filter(s => s.dividendYield >= 0.04 && s.dividendGrowthRate < 0.05).map(s => (
                  <div key={s.id} className="flex items-center justify-between bg-white px-3 py-2 rounded-xl border border-slate-100 text-xs font-mono">
                    <span className="font-bold text-slate-700">{s.name} ({s.ticker})</span>
                    <span className="text-blue-600 font-bold">Yield {(s.dividendYield * 100).toFixed(1)}% / Growth {(s.dividendGrowthRate * 100).toFixed(1)}%</span>
                  </div>
                ))}
                {stocks.filter(s => s.dividendYield >= 0.04 && s.dividendGrowthRate < 0.05).length === 0 && (
                  <div className="text-slate-400 text-[11px] text-center py-2 bg-white/50 rounded-xl border border-dashed border-slate-200">
                    해당되는 자산이 없습니다.
                  </div>
                )}
              </div>
            </div>

            {/* Quadrant 3: Dividend Growth (저배당 & 고성장) */}
            <div className="border border-indigo-100 bg-indigo-50/20 rounded-2xl p-5 space-y-4">
              <div className="flex justify-between items-start">
                <div className="space-y-0.5">
                  <span className="text-xs font-extrabold text-indigo-700 uppercase tracking-wider block">Quadrant C • 미래 성장동력 (Dividend Growth)</span>
                  <h4 className="font-bold text-slate-800 text-sm">저배당 & 고성장 자산</h4>
                </div>
                <span className="text-[10px] bg-indigo-100 text-indigo-800 font-bold px-2 py-0.5 rounded-full">
                  {stocks.filter(s => s.dividendYield < 0.04 && s.dividendGrowthRate >= 0.05).length}개 종목
                </span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                현재 시점의 배당금 수령액은 적지만 배당 성장 속도가 매우 빠른 성장 ETF 및 우량 테크주 위주입니다. 세월이 흐를수록 인수 배당률(Yield on Cost)이 눈덩이처럼 늘어납니다.
              </p>
              
              <div className="space-y-2">
                {stocks.filter(s => s.dividendYield < 0.04 && s.dividendGrowthRate >= 0.05).map(s => (
                  <div key={s.id} className="flex items-center justify-between bg-white px-3 py-2 rounded-xl border border-slate-100 text-xs font-mono">
                    <span className="font-bold text-slate-700">{s.name} ({s.ticker})</span>
                    <span className="text-indigo-600 font-bold">Yield {(s.dividendYield * 100).toFixed(1)}% / Growth {(s.dividendGrowthRate * 100).toFixed(1)}%</span>
                  </div>
                ))}
                {stocks.filter(s => s.dividendYield < 0.04 && s.dividendGrowthRate >= 0.05).length === 0 && (
                  <div className="text-slate-400 text-[11px] text-center py-2 bg-white/50 rounded-xl border border-dashed border-slate-200">
                    해당되는 자산이 없습니다.
                  </div>
                )}
              </div>
            </div>

            {/* Quadrant 4: Value Check (저배당 & 저성장) */}
            <div className="border border-slate-200 bg-slate-50 rounded-2xl p-5 space-y-4">
              <div className="flex justify-between items-start">
                <div className="space-y-0.5">
                  <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider block">Quadrant D • 가치 점검 필요 (Value Check)</span>
                  <h4 className="font-bold text-slate-800 text-sm">저배당 & 저성장 자산</h4>
                </div>
                <span className="text-[10px] bg-slate-200 text-slate-700 font-bold px-2 py-0.5 rounded-full">
                  {stocks.filter(s => s.dividendYield < 0.04 && s.dividendGrowthRate < 0.05).length}개 종목
                </span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                배당률도 4% 미만으로 비교적 낮고, 성장 속도마저 5% 미만인 주식입니다. 주가의 폭발적인 자본 차익(Capital Gain) 메리트가 없다면 포트폴리오 비중 조절을 진지하게 검토하십시오.
              </p>
              
              <div className="space-y-2">
                {stocks.filter(s => s.dividendYield < 0.04 && s.dividendGrowthRate < 0.05).map(s => (
                  <div key={s.id} className="flex items-center justify-between bg-white px-3 py-2 rounded-xl border border-slate-100 text-xs font-mono">
                    <span className="font-bold text-slate-700">{s.name} ({s.ticker})</span>
                    <span className="text-slate-500 font-bold">Yield {(s.dividendYield * 100).toFixed(1)}% / Growth {(s.dividendGrowthRate * 100).toFixed(1)}%</span>
                  </div>
                ))}
                {stocks.filter(s => s.dividendYield < 0.04 && s.dividendGrowthRate < 0.05).length === 0 && (
                  <div className="text-slate-400 text-[11px] text-center py-2 bg-white/50 rounded-xl border border-dashed border-slate-200">
                    해당되는 자산이 없습니다.
                  </div>
                )}
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
