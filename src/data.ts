import { Stock, SimulationConfig } from "./types";

/**
 * Seed portfolio shown on the very first launch.
 * All numbers below are real Yahoo Finance values captured on 2026-07-14 and
 * are automatically replaced with live data on every app load
 * (see refreshQuotes in App.tsx) — they only cover the moment before the
 * first sync completes.
 */
export const INITIAL_STOCKS: Stock[] = [
  {
    id: "realty-income",
    ticker: "O",
    name: "리얼티 인컴 (Realty Income)",
    currentPrice: 64.17,
    currency: "USD",
    dividendYield: 0.0505,
    payoutRatio: 0, // EPS 기반 배당성향은 리츠 특성상 왜곡이 커 표시 생략
    dividendGrowthRate: 0.0513,
    payoutFrequency: "Monthly",
    payoutMonths: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    growthStreak: 29,
    safetyScore: 67,
    safetyReason: "29년 연속 배당 증가와 매월 지급 이력을 가진 세계 최대 상업용 리츠입니다. (실측 데이터 기반 규칙 점수)",
    analysis: "리얼티 인컴은 세계 최대 규모의 단일 임차인 상업 부동산 리츠 중 하나입니다. 우량 기업들과의 장기 임대 계약(Triple Net Lease)을 통해 안정적인 임대료 현금흐름을 확보하고 있으며, 월배당이라는 강력한 장점이 있어 현금흐름 복리 투자에 적합합니다.",
    pros: [
      "매달 지급되는 월배당으로 빠른 재투자 현금흐름 확보 가능",
      "장기 임대 계약 및 우량 임차인 비중이 높아 공실 위험이 낮음",
      "29년 연속 배당을 성장시켜 온 검증된 이력"
    ],
    cons: [
      "고금리 환경이 장기화될 경우 부동산 대출 비용 부담 증가",
      "배당 성장 속도가 기술주나 성장 ETF 대비 느린 편"
    ],
    sharesOwned: 100, // Default shares owned
    historicalDividends: [
      { year: "2021", amount: 2.775 },
      { year: "2022", amount: 2.972 },
      { year: "2023", amount: 3.062 },
      { year: "2024", amount: 2.872 },
      { year: "2025", amount: 3.49 }
    ],
    cagrBreakdown: [
      { period: "1년 CAGR", rate: 0.2152 },
      { period: "3년 CAGR", rate: 0.055 },
      { period: "5년 CAGR", rate: 0.0513 },
      { period: "10년 CAGR", rate: 0.0467 }
    ]
  },
  {
    id: "schd",
    ticker: "SCHD",
    name: "슈왑 미국 배당형 ETF (Schwab US Dividend Equity ETF)",
    currentPrice: 32.56,
    currency: "USD",
    dividendYield: 0.0322,
    payoutRatio: 0.604,
    dividendGrowthRate: 0.0913,
    payoutFrequency: "Quarterly",
    payoutMonths: [2, 5, 8, 11],
    growthStreak: 14,
    safetyScore: 87,
    safetyReason: "부채비율, ROE, 배당수익률 등 엄격한 재무 지표를 기준으로 100개 우량 배당성장주에 분산 투자합니다.",
    analysis: "SCHD는 다우존스 US Dividend 100 지수를 추종하며, 배당금 지급 이력뿐만 아니라 탄탄한 재무제표를 가진 기업들을 선별합니다. 분산 투자 효과와 높은 배당 성장률을 동시에 제공해 배당 복리 재투자의 대표 선택지로 자리 잡았습니다.",
    pros: [
      "연평균 9%대에 달하는 높은 역사적 배당 성장률 (5Y CAGR 실측)",
      "100개 우량 기업 분산 투자로 개별 기업 리스크 완화",
      "저렴한 운용 수수료(0.06%)로 장기 보유 적합"
    ],
    cons: [
      "고배당주 중심이므로 단기 폭발적인 주가 상승률은 기대하기 어려움",
      "분기 배당으로 월배당 대비 재투자 주기가 긴 편"
    ],
    sharesOwned: 150,
    historicalDividends: [
      { year: "2021", amount: 0.75 },
      { year: "2022", amount: 0.854 },
      { year: "2023", amount: 0.8863 },
      { year: "2024", amount: 0.995 },
      { year: "2025", amount: 1.047 }
    ],
    cagrBreakdown: [
      { period: "1년 CAGR", rate: 0.0523 },
      { period: "3년 CAGR", rate: 0.0703 },
      { period: "5년 CAGR", rate: 0.0913 },
      { period: "10년 CAGR", rate: 0.106 }
    ]
  },
  {
    id: "coca-cola",
    ticker: "KO",
    name: "코카콜라 (Coca-Cola)",
    currentPrice: 84.25,
    currency: "USD",
    dividendYield: 0.0247,
    payoutRatio: 0.648,
    dividendGrowthRate: 0.0446,
    payoutFrequency: "Quarterly",
    payoutMonths: [2, 5, 8, 11],
    growthStreak: 63,
    safetyScore: 87,
    safetyReason: "60년이 넘는 배당왕(Dividend King) 주식으로 강력한 글로벌 브랜드 가치와 소비재 독점력을 보유하고 있습니다.",
    analysis: "코카콜라는 전 세계 음료 시장의 압도적인 1위 기업이자 워런 버핏이 사랑하는 핵심 배당왕 주식입니다. 인플레이션 국면에서도 가격 인상력을 발휘하여 수익성을 방어할 수 있는 강한 경제적 해자(Moat)를 가졌습니다.",
    pros: [
      "63년 이상 경기 침체와 무관하게 지속된 안정적인 배당 증배 이력",
      "인플레이션을 제품 가격에 전가할 수 있는 강력한 가격 결정권",
      "글로벌 매출 다변화로 특정 지역 리스크 방어 우수"
    ],
    cons: [
      "탄산음료 시장 성숙 및 건강 음료 트렌드로 인한 성장 둔화",
      "비교적 높은 수준의 밸류에이션(PER) 유지 부담"
    ],
    sharesOwned: 50,
    historicalDividends: [
      { year: "2021", amount: 1.68 },
      { year: "2022", amount: 1.76 },
      { year: "2023", amount: 1.84 },
      { year: "2024", amount: 1.94 },
      { year: "2025", amount: 2.04 }
    ],
    cagrBreakdown: [
      { period: "1년 CAGR", rate: 0.0515 },
      { period: "3년 CAGR", rate: 0.0504 },
      { period: "5년 CAGR", rate: 0.0446 },
      { period: "10년 CAGR", rate: 0.0445 }
    ]
  },
  {
    id: "macquarie-infra",
    ticker: "088980",
    name: "맥쿼리인프라 (Macquarie Korea Infrastructure)",
    currentPrice: 10110,
    currency: "KRW",
    dividendYield: 0.0722,
    payoutRatio: 0,
    dividendGrowthRate: 0.0109,
    payoutFrequency: "Semi-Annually",
    payoutMonths: [5, 11],
    growthStreak: 0,
    safetyScore: 54,
    safetyReason: "국가 인프라 통행료 수입 기반의 원화 현금흐름이 강점이나, 2024년 이후 분배금이 소폭 감소(775→760원)한 이력이 실측 데이터에 반영되어 있습니다.",
    analysis: "맥쿼리인프라는 한국 주식시장을 대표하는 고배당 인프라 펀드입니다. 도로, 교량, 항만 등 필수 인프라 자산의 통행료 수입을 재원으로 연 2회 분배금을 지급하며, 7%대의 원화 현금흐름을 제공합니다. 다만 일부 자산의 운영 기간 만료와 분배금 정체는 확인이 필요한 부분입니다.",
    pros: [
      "연 7%대의 높은 원화 배당수익률 (실측 기준)",
      "물가 상승에 연동되는 통행료 기반의 인플레이션 헷지 구조",
      "낮은 주가 변동성으로 심리적 장기 투자가 용이"
    ],
    cons: [
      "2024년 이후 분배금이 정체·소폭 감소한 실측 이력",
      "인프라 자산의 만기가 존재하여 장기적으로 신규 자산 발굴 필요"
    ],
    sharesOwned: 500,
    historicalDividends: [
      { year: "2021", amount: 750 },
      { year: "2022", amount: 770 },
      { year: "2023", amount: 775 },
      { year: "2024", amount: 760 },
      { year: "2025", amount: 760 }
    ],
    cagrBreakdown: [
      { period: "1년 CAGR", rate: 0 },
      { period: "3년 CAGR", rate: -0.0043 },
      { period: "5년 CAGR", rate: 0.0109 },
      { period: "10년 CAGR", rate: 0.0506 }
    ]
  }
];

export const DEFAULT_CONFIG: SimulationConfig = {
  initialCapital: 10000000, // 10 million KRW (~$7,500)
  monthlyContribution: 500000, // 500k KRW (~$370)
  contributionGrowthRate: 0.03, // 3% annual savings growth
  years: 25,
  reinvestmentStrategy: "DRIP",
  reinvestRate: 1.0,
  dividendTaxRate: 0.154, // 15.4% Korea
  stockPriceGrowthRate: 0.045 // 4.5% annual capital appreciation
};
