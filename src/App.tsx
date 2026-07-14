import React, { useState, useEffect, useMemo, useRef } from "react";
import { Stock, SimulationConfig } from "./types";
import { INITIAL_STOCKS, DEFAULT_CONFIG } from "./data";
import { calculatePortfolioMetrics, setFxRates } from "./utils";
import CompoundingSimulator from "./components/CompoundingSimulator";
import PortfolioPlanner from "./components/PortfolioPlanner";
import StockAnalyzer from "./components/StockAnalyzer";
import { 
  Calculator, 
  Briefcase, 
  Sparkles, 
  TrendingUp, 
  RefreshCw,
  Coins
} from "lucide-react";

export default function App() {
  const [activeTab, setActiveTab] = useState<"compounding" | "portfolio" | "analyzer">("compounding");
  
  // Load stocks state with localStorage fallback
  const [stocks, setStocks] = useState<Stock[]>(() => {
    const saved = localStorage.getItem("dividend_planner_stocks");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse saved stocks", e);
      }
    }
    return INITIAL_STOCKS;
  });

  // Load config state with localStorage fallback
  const [config, setConfig] = useState<SimulationConfig>(() => {
    const saved = localStorage.getItem("dividend_planner_config");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse saved config", e);
      }
    }
    return DEFAULT_CONFIG;
  });

  // Save state on change
  useEffect(() => {
    localStorage.setItem("dividend_planner_stocks", JSON.stringify(stocks));
  }, [stocks]);

  useEffect(() => {
    localStorage.setItem("dividend_planner_config", JSON.stringify(config));
  }, [config]);

  // --- Live quote refresh (prices, yields, FX) for the holdings ---
  const [isRefreshingQuotes, setIsRefreshingQuotes] = useState(false);
  const [lastQuoteSync, setLastQuoteSync] = useState<string | null>(
    () => localStorage.getItem("dividend_planner_quote_sync")
  );
  const stocksRef = useRef(stocks);
  stocksRef.current = stocks;

  const refreshQuotes = async () => {
    const holdings = stocksRef.current.map(s => ({ ticker: s.ticker, currency: s.currency }));
    if (holdings.length === 0 || isRefreshingQuotes) return;
    setIsRefreshingQuotes(true);
    try {
      const res = await fetch("/api/refresh-quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ holdings })
      });
      if (!res.ok) throw new Error(`refresh-quotes ${res.status}`);
      const result = await res.json();
      if (result.fxRates) setFxRates(result.fxRates);
      if (result.quotes) {
        setStocks(prev => prev.map(stock => {
          const q = result.quotes[stock.ticker];
          if (!q) return stock;
          return {
            ...stock,
            currentPrice: q.currentPrice,
            currency: q.currency || stock.currency,
            dividendYield: typeof q.dividendYield === "number" ? q.dividendYield : stock.dividendYield,
            dividendGrowthRate: typeof q.dividendGrowthRate === "number" && q.dividendGrowthRate !== 0
              ? q.dividendGrowthRate : stock.dividendGrowthRate,
            payoutFrequency: q.payoutFrequency || stock.payoutFrequency,
            payoutMonths: Array.isArray(q.payoutMonths) && q.payoutMonths.length > 0
              ? q.payoutMonths : stock.payoutMonths
          };
        }));
      }
      const syncTime = result.asOf || new Date().toLocaleString("ko-KR", { hour12: false });
      setLastQuoteSync(syncTime);
      localStorage.setItem("dividend_planner_quote_sync", syncTime);
    } catch (e) {
      console.error("Failed to refresh live quotes:", e);
    } finally {
      setIsRefreshingQuotes(false);
    }
  };

  // Refresh once on load so saved portfolios never show stale prices
  useEffect(() => {
    refreshQuotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle adding stock analyzed by Gemini
  const handleAddStock = (newStock: Stock) => {
    setStocks(prev => {
      // Check if stock with same ticker already exists
      const exists = prev.find(s => s.ticker === newStock.ticker);
      if (exists) {
        // Just add 10 more shares
        return prev.map(s => s.ticker === newStock.ticker ? { ...s, sharesOwned: s.sharesOwned + 10 } : s);
      }
      return [...prev, newStock];
    });
  };

  // Reset to default data
  const handleReset = () => {
    if (window.confirm("시뮬레이션 데이터와 포트폴리오를 초기화하시겠습니까?")) {
      setStocks(INITIAL_STOCKS);
      setConfig(DEFAULT_CONFIG);
      localStorage.removeItem("dividend_planner_stocks");
      localStorage.removeItem("dividend_planner_config");
    }
  };

  // Dynamically calculate the active parameters from portfolio to feed the Compounding Simulator
  const { weightedYield, weightedGrowthRate } = useMemo(() => {
    return calculatePortfolioMetrics(stocks);
  }, [stocks]);

  // Fallbacks if portfolio is empty
  const activeYield = stocks.length > 0 ? weightedYield : 0.045; // 4.5% default
  const activeDivGrowth = stocks.length > 0 ? weightedGrowthRate : 0.055; // 5.5% default
  const activePriceGrowth = config.stockPriceGrowthRate; // custom slider default

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800" id="root-container">
      {/* Premium Header */}
      <header className="bg-white border-b border-slate-100 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-md shadow-indigo-100 flex items-center justify-center">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-950 font-display">
                배당 복리 재투자 플래너
              </h1>
              <p className="text-xs text-slate-400">
                Dividend Compounding Planner • 미래 자산을 조형하는 스마트 현금흐름 솔루션
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={handleReset}
              className="flex items-center gap-1 px-3 py-1.5 border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-500 rounded-lg transition"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              포트폴리오 초기화
            </button>
            <div className="bg-slate-100 text-slate-500 text-[10px] font-mono font-bold px-2 py-1 rounded-md">
              v2.0 Live Market Data
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Arena */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Navigation Selector Buttons */}
        <div className="flex border-b border-slate-200">
          <button
            onClick={() => setActiveTab("compounding")}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-all ${
              activeTab === "compounding"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            <Calculator className="w-4 h-4" />
            배당 복리 계산기
          </button>
          
          <button
            onClick={() => setActiveTab("portfolio")}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-all ${
              activeTab === "portfolio"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            <Briefcase className="w-4 h-4" />
            나의 포트폴리오 설계 ({stocks.length})
          </button>
          
          <button
            onClick={() => setActiveTab("analyzer")}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-all ${
              activeTab === "analyzer"
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-400 hover:text-slate-600"
            }`}
          >
            <Sparkles className="w-4 h-4" />
            AI 종목 배당 분석
          </button>
        </div>

        {/* Dynamic Panel rendering */}
        <div className="min-h-[450px]">
          {activeTab === "compounding" && (
            <CompoundingSimulator
              config={config}
              setConfig={setConfig}
              portfolioYield={activeYield}
              portfolioDividendGrowth={activeDivGrowth}
              portfolioPriceGrowth={activePriceGrowth}
            />
          )}

          {activeTab === "portfolio" && (
            <PortfolioPlanner
              stocks={stocks}
              setStocks={setStocks}
              onRefreshQuotes={refreshQuotes}
              isRefreshingQuotes={isRefreshingQuotes}
              lastQuoteSync={lastQuoteSync}
            />
          )}

          {activeTab === "analyzer" && (
            <StockAnalyzer
              onAddStock={handleAddStock}
              existingTickers={stocks.map(s => s.ticker)}
            />
          )}
        </div>
      </main>

      {/* Decorative footer */}
      <footer className="bg-white border-t border-slate-100 py-8 mt-12 text-center text-xs text-slate-400 space-y-1">
        <p>© 2026 Dividend Compounding Planner. All rights reserved.</p>
        <p>본 시뮬레이션 및 분석 결과는 과거 데이터를 기반으로 한 참고용이며, 투자 손실과 최종 책임은 투자자 본인에게 귀속됩니다.</p>
      </footer>
    </div>
  );
}
