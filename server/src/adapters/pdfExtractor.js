import { createRequire } from "module";
import { AppError } from "../domain/errors.js";

const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");

/**
 * @param {Buffer} buffer
 * @returns {Promise<string>}
 */
export async function extractTextFromPdf(buffer) {
  let data;
  try {
    data = await pdfParse(buffer);
  } catch {
    throw new AppError("Invalid or unreadable PDF file.", 422);
  }
  const text = (data.text || "").trim();
  if (!text) {
    throw new AppError(
      "No readable text found in PDF (may be scanned/image-only).",
      422
    );
  }
  return text;
}
