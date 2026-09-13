import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import { stripeRouter } from "./stripe";
import { chatRouter } from "./chat";
import { pushRouter } from "./push";
import { securityHeaders, apiRateLimiter } from "./security";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const server = createServer(app);

  // Needed for correct req.protocol / rate-limit IPs behind a reverse
  // proxy (Render, Railway, etc. all sit behind one).
  app.set("trust proxy", 1);

  app.use(securityHeaders);

  // API routes — must be registered before the SPA catch-all below.
  app.use("/api", apiRateLimiter);
  app.use("/api", stripeRouter);
  app.use("/api", chatRouter);
  app.use("/api", pushRouter);

  // Serve static files from dist/public in production
  const staticPath =
    process.env.NODE_ENV === "production"
      ? path.resolve(__dirname, "public")
      : path.resolve(__dirname, "..", "dist", "public");

  app.use(express.static(staticPath));

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
