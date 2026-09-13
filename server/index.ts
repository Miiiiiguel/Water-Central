import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import { stripeRouter } from "./stripe";
import { chatRouter } from "./chat";
import { pushRouter } from "./push";
import { ttsRouter } from "./tts";
import { healthRouter } from "./health";
import { leadsRouter } from "./leads";
import { cspRouter } from "./csp";
import { securityHeaders, permissionsPolicy, corsPolicy, methodAllowlist, apiRateLimiter } from "./security";
import compression from "compression";
import { validateEnv } from "./env";
import { initMonitoring, attachErrorMonitoring, captureException } from "./monitoring";
import { logSecurityEvent } from "./log";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  validateEnv();
  initMonitoring();

  const app = express();
  const server = createServer(app);

  // Needed for correct req.protocol / rate-limit IPs behind a reverse
  // proxy (Render, Railway, etc. all sit behind one).
  app.set("trust proxy", 1);
  app.disable("x-powered-by");

  app.use(methodAllowlist);
  app.use(securityHeaders);
  app.use(permissionsPolicy);

  // API routes — must be registered before the SPA catch-all below.
  app.use("/api", corsPolicy);
  app.use("/api", apiRateLimiter);
  app.use("/api", stripeRouter);
  app.use("/api", chatRouter);
  app.use("/api", pushRouter);
  app.use("/api", ttsRouter);
  app.use("/api", healthRouter);
  app.use("/api", leadsRouter);
  app.use("/api", cspRouter);
  // Anything under /api that no router claimed is a 404, never the SPA shell.
  app.use("/api", (_req, res) => res.status(404).json({ error: "Not found" }));

  // Serve static files from dist/public in production
  const staticPath =
    process.env.NODE_ENV === "production"
      ? path.resolve(__dirname, "public")
      : path.resolve(__dirname, "..", "dist", "public");

  // gzip/brotli-negotiated compression for the static bundle (the main
  // JS chunk goes from ~1.2MB to ~340KB). Deliberately NOT applied to
  // /api responses: compressing responses that mix secrets with
  // attacker-influenced input is what the BREACH attack exploits.
  app.use(compression({ filter: (req, res) => !req.path.startsWith("/api") && compression.filter(req, res) }));

  // iOS Universal Links need this exact path with a JSON content type and
  // no extension — express.static would serve it as an octet-stream.
  app.get("/.well-known/apple-app-site-association", (_req, res) => {
    res.type("application/json").sendFile(path.join(staticPath, ".well-known", "apple-app-site-association"));
  });

  app.use(express.static(staticPath, { dotfiles: "allow" })); // .well-known/*

  // Handle client-side routing - serve index.html for all routes
  app.get("*", (_req, res) => {
    res.sendFile(path.join(staticPath, "index.html"));
  });

  // Sentry sees the error first (with request context), then we answer.
  attachErrorMonitoring(app);

  // One place that turns failures into small, generic responses. Client
  // mistakes get a precise status; anything else is logged with its
  // stack on the server and answered with a bare "Internal error" — no
  // stack traces, file paths, SQL or config ever reach a response.
  app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const isApi = req.path.startsWith("/api");
    if (err?.message === "Origin not allowed") return res.status(403).json({ error: "Origin not allowed" });
    if (err?.type === "entity.too.large") return res.status(413).json({ error: "Request body too large" });
    if (err?.type === "entity.parse.failed") return res.status(400).json({ error: "Malformed JSON" });

    logSecurityEvent("server_error", req, { message: String(err?.message ?? err).slice(0, 200) });
    console.error(err?.stack ?? err);
    captureException(err);
    if (isApi) return res.status(500).json({ error: "Internal error" });
    res.status(500).type("text/plain").send("Internal error");
  });

  const port = process.env.PORT || 3000;

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
