import { Router } from "express";
import multer from "multer";
import { analyzeResumePdf } from "../useCases/analyzeResume.js";
import {
  analyzeJobMatch,
  analyzeJobSuggestions,
  generateTailoredResume,
} from "../useCases/analyzeJobMatch.js";
import { AppError } from "../domain/errors.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok =
      file.mimetype === "application/pdf" ||
      (file.originalname || "").toLowerCase().endsWith(".pdf");
    if (!ok) {
      cb(new Error("Only PDF files are allowed."));
      return;
    }
    cb(null, true);
  },
});

export const analyzeRouter = Router();

analyzeRouter.post("/analyze", (req, res, next) => {
  upload.single("file")(req, res, (err) => {
    if (err) {
      res.status(400).json({ error: err.message || "Upload failed." });
      return;
    }
    next();
  });
}, async (req, res) => {
  try {
    if (!req.file?.buffer) {
      res.status(400).json({ error: "Missing file field `file` (PDF)." });
      return;
    }
    const result = await analyzeResumePdf(req.file.buffer);
    res.json(result);
  } catch (e) {
    if (e instanceof AppError) {
      res.status(e.statusCode).json({ error: e.message });
      return;
    }
    const message = e instanceof Error ? e.message : "Analysis failed.";
    res.status(500).json({ error: message });
  }
});

analyzeRouter.post("/match-jd", async (req, res) => {
  try {
    const result = await analyzeJobMatch(req.body?.resumeText, req.body?.jobDescription);
    res.json(result);
  } catch (e) {
    handleRouteError(res, e, "Job match analysis failed.");
  }
});

analyzeRouter.post("/jd-suggestions", async (req, res) => {
  try {
    const result = await analyzeJobSuggestions(req.body?.resumeText, req.body?.jobDescription);
    res.json(result);
  } catch (e) {
    handleRouteError(res, e, "JD suggestions failed.");
  }
});

analyzeRouter.post("/tailored-resume", async (req, res) => {
  try {
    const result = await generateTailoredResume(req.body?.resumeText, req.body?.jobDescription);
    res.json(result);
  } catch (e) {
    handleRouteError(res, e, "Tailored resume generation failed.");
  }
});

/**
 * @param {import("express").Response} res
 * @param {unknown} error
 * @param {string} fallbackMessage
 */
function handleRouteError(res, error, fallbackMessage) {
  if (error instanceof AppError) {
    res.status(error.statusCode).json({ error: error.message });
    return;
  }
  const message = error instanceof Error ? error.message : fallbackMessage;
  res.status(500).json({ error: message });
}
