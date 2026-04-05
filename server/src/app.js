import "dotenv/config";
import express from "express";
import cors from "cors";
import { getServerConfig } from "./config.js";
import { analyzeRouter } from "./routes/analyze.js";
import { uploadRouter } from "./routes/upload.js";

const { corsOrigins, uiUrl } = getServerConfig();

export const app = express();

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || !corsOrigins.length || corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("CORS origin not allowed."));
    },
  })
);

app.use(express.json({ limit: "1mb" }));

app.use("/upload", uploadRouter);
app.use("/api", analyzeRouter);

app.get("/", (req, res) => {
  const wantsJson = (req.get("accept") || "").includes("application/json");
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
      ui: uiUrl,
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
  <p><a href="${escapeHtml(uiUrl)}">${escapeHtml(uiUrl)}</a></p>
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

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
