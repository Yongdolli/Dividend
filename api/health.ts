// 배포 환경 자가 진단용: 어떤 모듈/호출이 실패하는지 단계별로 보고한다.
// 의도적으로 다른 모듈을 정적 import하지 않는다 (그 모듈이 크래시 원인일 수 있으므로).
export default async function handler(_req: any, res: any) {
  const info: Record<string, any> = {
    node: process.version,
    platform: process.platform,
    region: process.env.VERCEL_REGION ?? null
  };

  try {
    const mod: any = await import("yahoo-finance2");
    info.yahooImport = "ok";
    try {
      const yf = new mod.default({ suppressNotices: ["yahooSurvey"] });
      const q = await yf.quote("AAPL");
      info.yahooQuote = q?.regularMarketPrice ?? null;
    } catch (e: any) {
      info.yahooQuoteError = String(e?.message || e);
    }
  } catch (e: any) {
    info.yahooImportError = String(e?.stack || e?.message || e);
  }

  try {
    await import("./_lib/market.js");
    info.marketImport = "ok";
  } catch (e: any) {
    info.marketImportError = String(e?.stack || e?.message || e);
  }

  res.status(200).json(info);
}
