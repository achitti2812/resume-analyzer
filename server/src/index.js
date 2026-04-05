import "dotenv/config";
import express from "express";
import cors from "cors";
import { getServerConfig } from "./config.js";
import { analyzeRouter } from "./routes/analyze.js";
import { uploadRouter } from "./routes/upload.js";

const { port, corsOrigins } = getServerConfig();
const app = express();

app.use(
  cors({
    origin: corsOrigins.length ? corsOrigins : true,
  })
);
app.use(express.json({ limit: "1mb" }));

app.use("/upload", uploadRouter);
app.use("/api", analyzeRouter);

app.get("/", (_req, res) => {
  const wantsJson = (_req.get("accept") || "").includes("application/json");
  if (wantsJson) {
    res.json({
      service: "resume-analyzer-api",
      endpoints: {
        health: "GET /health",
        upload: "POST /upload (multipart field: file)",
        analyze: "POST /api/analyze (multipart field: file)",
        matchJd: "POST /api/match-jd ({ resumeText, jobDescription })",
        jdSuggestions: "POST /api/jd-suggestions ({ resumeText, jobDescription })",
        tailoredResume: "POST /api/tailored-resume ({ resumeText, jobDescription })",
      },
      ui: "http://localhost:5173 — run `npm run dev` in client/",
    });
    return;
  }
  res.type("html").send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Resume Analyzer API</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 36rem; margin: 2rem auto; padding: 0 1rem;
      background: #0f1219; color: #e8eaef; line-height: 1.5; }
    h1 { font-size: 1.35rem; font-weight: 700; }
    p { color: #8b94a8; }
    code, pre { background: #171b26; padding: 0.2em 0.45em; border-radius: 6px; font-size: 0.9em; }
    ul { padding-left: 1.2rem; }
    a { color: #6ee7b7; }
  </style>
</head>
<body>
  <h1>Resume Analyzer API</h1>
  <p>This host is the <strong>backend only</strong>. Open the app in the browser here:</p>
  <p><a href="http://localhost:5173">http://localhost:5173</a> (run <code>npm run dev</code> inside <code>client/</code>)</p>
  <p><strong>Endpoints</strong></p>
  <ul>
    <li><code>GET /health</code> — liveness</li>
    <li><code>POST /upload</code> — PDF → JSON <code>{ text }</code></li>
    <li><code>POST /api/analyze</code> — PDF → AI analysis JSON</li>
    <li><code>POST /api/match-jd</code> — JSON <code>{ resumeText, jobDescription }</code> → match analysis</li>
    <li><code>POST /api/jd-suggestions</code> — JSON <code>{ resumeText, jobDescription }</code> → suggestions</li>
    <li><code>POST /api/tailored-resume</code> — JSON <code>{ resumeText, jobDescription }</code> → tailored resume draft</li>
  </ul>
</body>
</html>`);
});

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

const server = app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});

server.on("error", (err) => {
  const code = /** @type {NodeJS.ErrnoException} */ (err).code;
  if (code === "EADDRINUSE") {
    const tryPort = port + 1;
    console.error(
      `Port ${port} is already in use.\n\n` +
        `Free it:\n` +
        `  lsof -nP -iTCP:${port} -sTCP:LISTEN\n` +
        `  kill <PID>\n\n` +
        `Or use another port:\n` +
        `  PORT=${tryPort} npm run dev\n` +
        `  (set client/vite.config.js proxy "target" to http://localhost:${tryPort})`
    );
  } else {
    console.error(err);
  }
  process.exit(1);
});
