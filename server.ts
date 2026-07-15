import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import {
  fxHandler,
  syncRecsHandler,
  refreshQuotesHandler,
  analyzeStockHandler,
  backtestHandler
} from "./api/_lib/market";

// Local development / self-hosted server.
// On Vercel the same handlers run as serverless functions (see api/).
async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

  app.get("/api/fx", fxHandler);
  app.get("/api/sync-recs", syncRecsHandler);
  app.post("/api/refresh-quotes", refreshQuotesHandler);
  app.post("/api/analyze-stock", analyzeStockHandler);
  app.post("/api/backtest", backtestHandler);

  // Serve static assets or use Vite middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
