import { Router } from "express";
import multer from "multer";
import { extractTextFromPdf } from "../adapters/pdfExtractor.js";
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

export const uploadRouter = Router();

uploadRouter.post("/", (req, res, next) => {
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
    const text = await extractTextFromPdf(req.file.buffer);
    res.json({ text });
  } catch (e) {
    if (e instanceof AppError) {
      res.status(e.statusCode).json({ error: e.message });
      return;
    }
    const message = e instanceof Error ? e.message : "Extraction failed.";
    res.status(500).json({ error: message });
  }
});
