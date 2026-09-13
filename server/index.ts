import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import { stripeRouter } from "./stripe";
import { chatRouter } from "./chat";
import { pushRouter } from "./push";
import { ttsRouter } from "./tts";
import { healthRouter } from "./health";
import { securityHeaders, permissionsPolicy, corsPolicy, methodAllowlist, apiRateLimiter } from "./security";
import { validateEnv } from "./env";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  validateEnv();

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
  // Anything under /api that no router claimed is a 404, never the SPA shell.
  app.use("/api", (_req, res) => res.status(404).json({ error: "Not found" }));

  // One place that turns middleware failures into small JSON responses.
  // Without this Express would answer 500 with a stack trace in the log
  // for things that are really client errors (bad origin, body too big,
  // malformed JSON), and never tell the caller what went wrong.
  app.use("/api", (err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err?.message === "Origin not allowed") return res.status(403).json({ error: "Origin not allowed" });
    if (err?.type === "entity.too.large") return res.status(413).json({ error: "Request body too large" });
    if (err?.type === "entity.parse.failed") return res.status(400).json({ error: "Malformed JSON" });
    console.error("API error:", err?.message ?? err);
    res.status(500).json({ error: "Internal error" });
  });

  // Serve static files from dist/public in production
  const staticPath =
    process.env.NODE_ENV === "production"
      ? path.resolve(__dirname, "public")
      : path.resolve(__dirname, "..", "dist", "public");

  app.use(express.static(staticPath, { dotfiles: "allow" })); // .well-known/security.txt

  // Handle client-side routing - serve index.html for all routes
  app.get("*", (_req, res) => {
    res.sendFile(path.join(staticPath, "index.html"));
  });

  const port = process.env.PORT || 3000;

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
