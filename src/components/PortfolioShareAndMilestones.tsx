import React, { useState, useMemo } from "react";
import { Stock } from "../types";
import { 
  Coffee, 
  Smartphone, 
  Utensils, 
  Home, 
  Plane, 
  Sparkles, 
  Share2, 
  Copy, 
  Check, 
  Download, 
  Goal, 
  Flame, 
  Award,
  ChevronRight,
  Info
} from "lucide-react";
import { formatCurrency, calculatePortfolioMetrics, toKRW } from "../utils";

interface PortfolioShareAndMilestonesProps {
  stocks: Stock[];
}

export default function PortfolioShareAndMilestones({ stocks }: PortfolioShareAndMilestonesProps) {
  const [copied, setCopied] = useState(false);
  const [activeReceiptTab, setActiveReceiptTab] = useState<"text" | "receipt">("receipt");

  // Calculate metrics
  const { totalValueKRW, totalAnnualDividendKRW, weightedYield, weightedTaxRate } = useMemo(() => {
    return calculatePortfolioMetrics(stocks);
  }, [stocks]);

  // Currency-weighted withholding tax (KR 15.4% / US 15%) for net monthly income
  const netMonthlyDividend = useMemo(() => {
    return (totalAnnualDividendKRW * (1 - weightedTaxRate)) / 12;
  }, [totalAnnualDividendKRW, weightedTaxRate]);

  // Milestones definitions
  const milestones = useMemo(() => [
    {
      id: "coffee",
      level: 1,
      title: "스타벅스 아메리카노 1잔",
      cost: 4500,
      icon: Coffee,
      color: "bg-emerald-600 text-emerald-600 border-emerald-100",
      description: "매월 스타벅스 프리미엄 커피 한 잔을 공짜로 마시는 소소한 기쁨"
    },
    {
      id: "phone",
      level: 2,
      title: "무제한 모바일 통신비",
      cost: 65000,
      icon: Smartphone,
      color: "bg-blue-600 text-blue-600 border-blue-100",
      description: "평생 통신비 걱정 없이 모바일 라이프를 즐길 수 있는 단계"
    },
    {
      id: "dining",
      level: 3,
      title: "격주 주말 안심 스테이크 외식",
      cost: 250000,
      icon: Utensils,
      color: "bg-indigo-600 text-indigo-600 border-indigo-100",
      description: "가족, 연인과 함께 주말마다 럭셔리한 외식 식사를 자부할 수 있는 자격"
    },
    {
      id: "rent",
      level: 4,
      title: "서울 원룸 평균 월임차료",
      cost: 650000,
      icon: Home,
      color: "bg-amber-600 text-amber-600 border-amber-100",
      description: "지출 비중이 가장 큰 주거 비용을 완전히 배당 수익으로 무력화시키는 시점"
    },
    {
      id: "travel",
      level: 5,
      title: "연 2회 동남아 비즈니스 여행",
      cost: 1500000,
      icon: Plane,
      color: "bg-violet-600 text-violet-600 border-violet-100",
      description: "매달 150만 원 상당 적립 효과로, 계절마다 최고급 힐링 여행을 떠납니다"
    },
    {
      id: "freedom",
      level: 6,
      title: "월배당 300만원 (경제적 자유)",
      cost: 3000000,
      icon: Award,
      color: "bg-rose-600 text-rose-600 border-rose-100",
      description: "노동을 원치 않을 때 멈출 수 있는 은퇴 단계. 진정한 시간의 주인이 됩니다"
    }
  ], []);

  // Top Holdings for sharing card representation
  const topHoldingsText = useMemo(() => {
    if (stocks.length === 0) return "없음";
    const sorted = [...stocks].sort((a, b) => {
      const priceA = toKRW(a.currentPrice, a.currency);
      const priceB = toKRW(b.currentPrice, b.currency);
      return (b.sharesOwned * priceB) - (a.sharesOwned * priceA);
    });

    return sorted.slice(0, 3).map(s => `${s.ticker}(${((s.sharesOwned * toKRW(s.currentPrice, s.currency) / totalValueKRW) * 100).toFixed(0)}%)`).join(", ");
  }, [stocks, totalValueKRW]);

  // Generate nice KakaoTalk/Telegram sharing message template
  const shareMessage = useMemo(() => {
    const formattedVal = formatCurrency(totalValueKRW);
    const formattedAnnual = formatCurrency(totalAnnualDividendKRW);
    const formattedNetMonthly = formatCurrency(netMonthlyDividend);
    const yieldPercentage = (weightedYield * 100).toFixed(2);
    
    return `📈 [배당 복리 재투자 플래너] 나의 배당 연금 현황

💵 총 포트폴리오 자산: ${formattedVal}
💸 연간 배당금 (세전): ${formattedAnnual}
🏡 세후 월평균 실수령: ${formattedNetMonthly}
📊 평균 포트폴리오 배당수익률: ${yieldPercentage}%

🏆 핵심 주력 종목: ${topHoldingsText}
🎯 최신 달성 완료 이정표: ${
      netMonthlyDividend === 0 
        ? "준비 중" 
        : milestones.filter(m => netMonthlyDividend >= m.cost).pop()?.title || "1단계 스타벅스 적립 중!"
    }

💡 미래 배당 복리 설계하러 가기:
${window.location.origin}`;
  }, [totalValueKRW, totalAnnualDividendKRW, netMonthlyDividend, weightedYield, topHoldingsText, milestones]);

  const handleCopy = () => {
    navigator.clipboard.writeText(shareMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (stocks.length === 0) return;
    
    const headers = ["Ticker", "Name", "Price", "Currency", "Yield(%)", "Growth(%)", "Payout Frequency", "Shares Owned", "Total Value(KRW)"];
    const rows = stocks.map(s => {
      const valueKRW = s.sharesOwned * toKRW(s.currentPrice, s.currency);
      return [
        s.ticker,
        s.name,
        s.currentPrice,
        s.currency,
        (s.dividendYield * 100).toFixed(2),
        (s.dividendGrowthRate * 100).toFixed(2),
        s.payoutFrequency,
        s.sharesOwned,
        Math.round(valueKRW)
      ];
    });

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `dividend_portfolio_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in slide-in-from-bottom-3 duration-500">
      
      {/* 1. Life Style Milestones Progress (Col Span 7) */}
      <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-100 p-6 shadow-xs space-y-6">
        <div className="flex justify-between items-center pb-4 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
              <Goal className="w-5 h-5 text-indigo-600" />
              배당금 생활밀착형 이정표 챌린지
            </h3>
            <p className="text-xs text-slate-400">나의 매월 순배당금이 실생활의 어떤 지출들을 평생 방어할 수 있을까요?</p>
          </div>
          <div className="bg-slate-50 border border-slate-100 px-3 py-1 rounded-lg text-xs font-semibold text-slate-600 flex items-center gap-1">
            <Flame className="w-4 h-4 text-orange-500" />
            세후 월평균 {formatCurrency(netMonthlyDividend)}
          </div>
        </div>

        {stocks.length === 0 ? (
          <div className="text-center py-16 text-slate-400 text-xs">
            포트폴리오 설계 탭에서 주식과 수량을 입력하시면 이정표 게이지가 역동적으로 차오릅니다!
          </div>
        ) : (
          <div className="space-y-4 max-h-[480px] overflow-y-auto pr-1">
            {milestones.map((m) => {
              const progress = Math.min(100, (netMonthlyDividend / m.cost) * 100);
              const isAchieved = progress >= 100;
              const IconComp = m.icon;

              return (
                <div 
                  key={m.id} 
                  className={`border rounded-2xl p-4.5 transition-all duration-300 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
                    isAchieved 
                      ? "bg-indigo-50/20 border-indigo-100 shadow-xs" 
                      : "bg-white border-slate-100 hover:border-slate-200"
                  }`}
                >
                  <div className="flex items-center gap-3.5 flex-1">
                    <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${
                      isAchieved ? "bg-indigo-600 text-white border-indigo-600" : "bg-slate-50 text-slate-400 border-slate-100"
                    }`}>
                      <IconComp className="w-5 h-5" />
                    </div>
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-400 font-extrabold font-mono">LEVEL {m.level}</span>
                        <h4 className="font-bold text-slate-800 text-sm">{m.title}</h4>
                        {isAchieved && (
                          <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full flex items-center gap-0.5 animate-bounce">
                            <Check className="w-3 h-3" /> 달성 완료
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 line-clamp-1">{m.description}</p>
                    </div>
                  </div>

                  <div className="w-full md:w-48 space-y-1.5 text-right font-sans shrink-0">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-[11px] font-mono font-bold text-indigo-600">
                        {progress.toFixed(0)}%
                      </span>
                      <span className="text-slate-500 text-[11px] font-semibold">
                        {formatCurrency(m.cost)} / 월
                      </span>
                    </div>
                    
                    {/* Visual Progress Bar */}
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200/40">
                      <div 
                        className={`h-full rounded-full transition-all duration-1000 ${
                          isAchieved ? "bg-indigo-600" : "bg-indigo-400"
                        }`}
                        style={{ width: `${progress}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 2. Share Portfolio Card / Receipt Mockup (Col Span 5) */}
      <div className="lg:col-span-5 flex flex-col space-y-6">
        
        {/* Share card wrapper */}
        <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-xl border border-slate-800 flex flex-col justify-between space-y-6 min-h-[420px]">
          
          {/* Header Controls of Share Card */}
          <div className="flex justify-between items-center pb-3 border-b border-slate-800/80">
            <span className="text-[11px] font-extrabold text-indigo-400 tracking-wider font-mono uppercase flex items-center gap-1.5">
              <Sparkles className="w-4 h-4" />
              배당 연금 보증 위젯
            </span>
            <div className="flex p-0.5 bg-slate-800 rounded-lg text-[11px] font-bold">
              <button
                onClick={() => setActiveReceiptTab("receipt")}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  activeReceiptTab === "receipt" ? "bg-slate-700 text-white" : "text-slate-400"
                }`}
              >
                배당 영수증
              </button>
              <button
                onClick={() => setActiveReceiptTab("text")}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  activeReceiptTab === "text" ? "bg-slate-700 text-white" : "text-slate-400"
                }`}
              >
                카톡 공유 문구
              </button>
            </div>
          </div>

          {activeReceiptTab === "receipt" ? (
            /* Aesthetic Receipt Layout */
            <div className="bg-white text-slate-800 rounded-xl p-5 shadow-inner border border-slate-200 font-mono text-xs space-y-4 flex-1">
              <div className="text-center space-y-1 pb-3 border-b border-dashed border-slate-300">
                <span className="font-extrabold text-sm tracking-widest text-slate-900 block font-display">DIVIDEND RECEIPT</span>
                <p className="text-[10px] text-slate-400">{new Date().toLocaleString("ko-KR")} 발행</p>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-400">포트폴리오 자산</span>
                  <span className="font-bold text-slate-800">{formatCurrency(totalValueKRW)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">연배당금 (세전)</span>
                  <span className="font-bold text-indigo-600">{formatCurrency(totalAnnualDividendKRW)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">월배당금 (세후)</span>
                  <span className="font-bold text-emerald-600">{formatCurrency(netMonthlyDividend)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">평균 가중 배당률</span>
                  <span className="font-bold text-slate-800">{(weightedYield * 100).toFixed(2)}%</span>
                </div>
              </div>

              <div className="border-t border-dashed border-slate-300 pt-3 space-y-2">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">주요 주주 비중 TOP 3</div>
                <p className="text-[11px] text-slate-600 leading-relaxed font-semibold">
                  {stocks.length > 0 ? topHoldingsText : "등록된 자산이 없습니다."}
                </p>
              </div>

              <div className="border-t border-dashed border-slate-300 pt-3 text-center text-[10px] text-indigo-600 font-bold">
                * 배당 복리 재투자는 미래 자산을 극적으로 키웁니다 *
              </div>
            </div>
          ) : (
            /* Text share message view block */
            <div className="bg-slate-950/80 rounded-xl p-4 text-xs font-mono text-slate-300 whitespace-pre-wrap overflow-y-auto max-h-[220px] flex-1 border border-slate-800">
              {shareMessage}
            </div>
          )}

          {/* Action buttons wrapper */}
          <div className="flex flex-col sm:flex-row gap-2.5">
            <button
              onClick={handleCopy}
              className="flex-1 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-300" />
                  클립보드 복사 완료!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  공유 텍스트 복사하기
                </>
              )}
            </button>

            <button
              onClick={handleExportCSV}
              disabled={stocks.length === 0}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 border border-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-4 h-4" />
              엑셀 내보내기 (.CSV)
            </button>
          </div>
        </div>

        {/* Informative Help Guide Card */}
        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 space-y-3">
          <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
            <Info className="w-4 h-4 text-indigo-500" />
            배당 파이프라인 형성 꿀팁!
          </h4>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            배당금은 지급 주기에 맞춰 분기 혹은 반기로 나뉘어 지급됩니다. 만약 연중 마르지 않는 현금흐름을 설계하고 싶다면 매월 지급형 리츠(예: O)나 분기 지급 월이 서로 다른 우량주(예: 3월/6월/9월/12월 배당주와 1월/4월/7월/10월 배당주)를 조화롭게 섞어 포트폴리오를 채우는 전략이 주효합니다.
          </p>
        </div>

      </div>
    </div>
  );
}
